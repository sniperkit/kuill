import { putResource, removeResource } from '../state/actions/resources'
import { addError } from '../state/actions/errors'
import { receiveEvents } from '../state/actions/events'

const throttles = {
  'Endpoints/MODIFIED': 10000,
}
const throttlePurgeInterval = 2 * 60 * 1000
const aggregationInterval = 1000

export default class ResourceKindWatcher {

  constructor(props) {

    this.props = props
    this.tries = 0
    this.initialize = this.initialize.bind(this)
    if (!!props.kind && !!props.dispatch && !!props.getState) {
      this.kubeKinds = props.getState().apimodels.kinds
      this.initialize()
    }
  }

  initialize = () => {
    let { props } = this
    this.namespaces = props.namespaces || []
    this.swagger = props.swagger
    this.dispatch = props.dispatch
    this.getState = props.getState
    this.kind = this.kubeKinds[props.kind]
    let resourceVersion = props.resourceVersion || 0
    let loc = window.location
    let scheme = (loc.protocol === 'https:' ? 'wss' : 'ws')
    this.onEvent = this.onEvent.bind(this)

    this.urls = []
    for (let ns of this.namespaces) {
      this.urls.push(this.websocketUrl(scheme, loc.host, this.kind, resourceVersion, ns))
    }

    this.sockets = {}
    for (let url of this.urls) {
      this.initSocket(url)
    }

    this.throttled = {}
    this.lastPurge = Date.now()
    this.events = []
    this.interval = window.setInterval(this.processEvents.bind(this), props.interval || aggregationInterval)
  }

  websocketUrl(scheme, host, kubeKind, resourceVersion, ns) {
    let url = `${scheme}://${host}/proxy`
    url += `/${kubeKind.base}/`
    if (!!ns && ns !== '*') {
      url += `namespaces/${ns}/`
    }
    url += `${kubeKind.plural}`
    url += `?watch=true&resourceVersion=${resourceVersion}`
    return url
  }

  processEvents = () => {
    while (this.events.length) {
      let data = this.events.shift()
      if (data.object && data.object.kind === 'Event') {
        let resources = this.getState().resources.resources
        this.dispatch(receiveEvents(resources, data))
      } else {
        switch(data.type) {
          case 'ADDED':
            this.dispatch(putResource(data.object, true))  
            break
          case 'MODIFIED': 
            this.dispatch(putResource(data.object, false))
            break
          case 'DELETED':
            this.dispatch(removeResource(data.object))
            break
          default:
            return 
        }
      }
    }
  }

  closed = () => {
    return !this.socket || this.socket.readyState === 3 || this.socket.readyState === 2
  }

  onEvent = (event) => {
    let data = this.applyThrottles(JSON.parse(event.data))
    if (!!data) {
      this.events.push(data)
    }
  }

  destroy = () => {
    this.interval && window.clearInterval(this.interval)
    this.socket && this.socket.close()
  }

  reset = () => {
    this.destroy()
    this.initialize()
  }

  reload = (url) => {
    let socket = this.sockets[url]
    if (socket) {
      socket.close()
    }
    this.initSocket(url)
  }

  initSocket = (url) => {
    let tries = (this.sockets[url] && this.sockets[url].tries) || 0
    let socket = new WebSocket(url)
    socket.tries = tries
    let that = this
    socket.onerror = function (e) {
      if (socket.tries < 3) {
        ++socket.tries
        window.setTimeout(that.reload.bind(that, url), 3000)
      } else {
        that.dispatch(addError(e,'error',`Error occurred in watch for ${url}`))
      }
    }
    socket.onmessage = this.onEvent
    this.sockets[url] = socket
  }
  /**
   * 
   */
  applyThrottles = (data) => {
    let resource = data.object
    let throttle = throttles[`${resource.kind}/${data.type}`]
    if (!!throttle) {
      let key = `${resource.metadata.namespace}/${resource.kind}/${resource.metadata.name}/${data.type}`
      let lastSeen = this.throttled[key] || 0
      let now = Date.now()
      this.purgeThrottles(now)
      if ((now - lastSeen) > throttle) {
        this.throttled[key] = now
        return data
      }
      return null
    }
    return data
  }

  purgeThrottles = (now) => {
    if ((now - this.lastPurge) > throttlePurgeInterval) {
      for (let t in this.throttled) {
        let throttle = throttles[t]
        let lastSeen = this.throttled[t]
        if (now - lastSeen > throttle) {
          delete this.throttled[t]
        }
      }
      this.lastPurge = now
    }
  }
}
