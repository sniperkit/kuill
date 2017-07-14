import React from 'react'
import {Card, CardHeader, CardText} from 'material-ui/Card'
import {blueA100, blueA400, grey600} from 'material-ui/styles/colors'
import KubeKinds from '../../kube-kinds'
import sizeMe from 'react-sizeme'
import AnnotationsPanel from './AnnotationsPanel'
import BasicDetailsPanel from './BasicDetailsPanel'
import PodTemplatePanel from './PodTemplatePanel'

const styles = {
  tabs: {
    backgroundColor: grey600,
  },
  tabsInkBar: {
    backgroundColor: blueA400,
    height: 3,
    marginTop: -4,
    borderTop: `1px ${blueA100} solid`,
  },
  cards: {
    margin: 10,
    boxShadow: 'none',
  },
  cardHeader: {
    borderBottom: '1px solid rgba(0,0,0,0.1)',
    padding: '0 0 5px 0',
    margin: '0 16px',
  },
  cardHeaderTitle: {
    color: 'rgba(0,0,0,0.4)',
    fontWeight: 600,
    fontStyle: 'italic',
    fontSize: '18px',
  }
}

// use functional component style for representational components
export default sizeMe({ monitorHeight: true, monitorWidth: true }) (
class ConfigurationPane extends React.Component {
  
  constructor(props) {
    super(props)
    this.state = {
      annotationsOpen: false,
      annotationsText: '',
    }
  }

  handleAnnotationsTouchTap = (event) => {
    // This prevents ghost click.
    event.preventDefault();

    this.setState({
      annotationsOpen: true,
      annotationsAnchorEl: event.currentTarget,
      annotationsText: event.currentTarget.dataset.text,
    })
  }

  handleRequestCloseAnnotations = () => {
    this.setState({
      annotationsOpen: false,
      annotationsText: '',
    })
  }

  render() {
  
    let { props } = this
    let { resource } = props
    let kind = KubeKinds[props.resourceGroup][resource.kind]
    let { getData } = kind
    let data = (typeof getData === 'function' && getData(resource)) || []
    
    let contents = null
    if (resource.kind === 'Pod') {
      contents = (
        <PodTemplatePanel pod={resource}>
          <div className="col-xs-12 col-sm-12 col-md-12 col-lg-12">
            <AnnotationsPanel annotations={resource.metadata.annotations} />
          </div>
        </PodTemplatePanel>
      )
    } else {

      contents = (
        <div className="row" style={{marginLeft: 0, marginRight: 0}}> 
          <div className="col-xs-12 col-sm-12 col-md-6 col-lg-6">
            <Card style={{...styles.cards, paddingRight: 16}}>
              <CardHeader 
                style={styles.cardHeader}
                title={'status'}
                titleStyle={styles.cardHeaderTitle}
              />
              <CardText>
                  <BasicDetailsPanel data={data}/>
              </CardText>
            </Card>
          </div>

          {/* {!!resource.spec.template && 
            <PodTemplatePanel pod={resource.spec.template} />
          } */}

          <div className="col-xs-12 col-sm-12 col-md-12 col-lg-12">
            <AnnotationsPanel annotations={resource.metadata.annotations} />
          </div>
        </div>
      )
    }
    return <div style={{
      height: `${window.innerHeight - props.contentTop - 40}px`,
      overflow: 'auto',
    }}>{contents}</div>
  }

})
