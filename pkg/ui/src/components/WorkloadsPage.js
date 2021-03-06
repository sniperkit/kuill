import React from 'react'
import { Link } from 'react-router-dom'
import FloatingActionButton from 'material-ui/FloatingActionButton'
import { blueA400, grey200, grey300, grey500, grey800, red900, white } from 'material-ui/styles/colors'
import { connect } from 'react-redux'
import { addFilter, removeFilter, removeResource, scaleResource, viewResource, detachResource } from '../state/actions/resources'
import sizeMe from 'react-sizeme'
import FilterTable from './filter-table/FilterTable'

import { withRouter } from 'react-router-dom'
import IconAdd from 'material-ui/svg-icons/content/add'
import IconDelete from 'material-ui/svg-icons/action/delete'
import IconSuspend from 'material-ui/svg-icons/content/block'
import Paper from 'material-ui/Paper'

import { arraysEqual, objectEmpty } from '../comparators'
import { compareStatuses, kindsByResourceGroup, anySelectedWithReplicas } from '../utils/resource-utils'
import { getResourceCellValue, renderResourceCell } from '../utils/resource-column-utils'

import FilterBox from './FilterBox'
import ConfirmationDialog from './ConfirmationDialog'
import ScaleDialog from './ScaleDialog'
import FilteredResourceCountsPanel from './FilteredResourceCountsPanel'
import RowActionMenu from './RowActionMenu'
import Checkbox from 'material-ui/Checkbox'
import MultiResourceActionButton from './MultiResourceActionButton'
import './WorkloadsPage.css'

// import Perf from 'react-addons-perf'

const mapStateToProps = function(store) {
  return {
    filters: store.resources.filters,
    filterNames: store.resources.filterNames,
    autocomplete: store.resources.autocomplete.workloads,
    accessEvaluator: store.session.accessEvaluator,
    kinds: store.apimodels.kinds,
    linkGenerator: store.session.linkGenerator,
    podMetrics: store.metrics.pod,
    resourceRevision: store.resources.resourceRevision,
    metricsRevision: store.metrics.revision,
  }
}

const mapDispatchToProps = function(dispatch, ownProps) {
  return {
    addFilter: function(filterName) {
      dispatch(addFilter(filterName))
    },
    removeFilter: function(filterName, index) {
      dispatch(removeFilter(filterName, index))
    },
    viewResource: function(resource, view='config') {
      dispatch(viewResource(resource,view))
    },
    removeResource: function(...resources) {
      dispatch(removeResource(...resources))
    },
    detachResource: function(resource) {
      dispatch(detachResource(resource))
    },
    scaleResource: function(resource, replicas) {
      dispatch(scaleResource(
        resource.metadata.namespace,
        resource.kind,
        resource.metadata.name,
        replicas))
    }
  } 
}

const styles = {
  newResourceButton: {
    margin: 0,
    top: 100,
    right: 60,
    bottom: 'auto',
    left: 'auto',
    position: 'fixed',
  },
  deleteResourceButton: {
    margin: 0,
    top: 110,
    right: 130,
    bottom: 'auto',
    left: 'auto',
    position: 'fixed',
  },
  suspendResourceButton: {
    margin: 0,
    top: 110,
    right: 180,
    bottom: 'auto',
    left: 'auto',
    position: 'fixed',
  },
  editButton: {
    fill: grey500
  },
  cell: {
    paddingLeft: 2,
    paddingRight: 2,
  },
  header: {
    fontWeight: 600,
    fontSize: '13px',
    color: white,
    fill: white,
  },
  iconButton: {
    float: 'left',
    paddingTop: 17
  },
  editLink: {
    color: blueA400,
    fontWeight: 600,
    textDecoration: 'none',
  },
  miniButton: {
    margin: 10,
  },
  popover: {
    marginTop: 8,
    marginLeft: 15,
    marginRight: 0,
    paddingLeft: 15,
    paddingRight: 15,
    paddingTop: 6,
    paddingBottom: 6,
    backgroundColor: '#BBB',
    border: '1px solid #000',
    borderRadius: '3px',
    boxShadow: 'rgba(0, 0, 0, 0.16) 0px 3px 10px, rgba(0, 0, 0, 0.23) 0px 3px 10px',
    display: 'flex',
  },
  paper: {
    padding: 15,
    margin: 5,
    height: 'calc(100vh - 110px)',
    border: '1px solid rgba(33,33,33,0.8)',
    position: 'absolute,'
  },
  statusIcon: {
    marginLeft: 10,
  },
  actionContainer: {
    position: 'relative',
    display: 'inline-block',
    float: 'left',
  },
  actionLabel: {
    position: 'absolute',
    bottom: 0,
    textAlign: 'center',
    width: '100%',
    color: white,
    fontSize: 10,
    zIndex: 100,
    pointerEvents: 'none',
  },
  actionButton: {
    backgroundColor: 'transparent',
    marginTop: 4,
    marginBottom: 4,
    color: grey200,
    fontSize: 18,
    fontWeight: 600,
  },
  actionButtonLabel: {
    textTransform: 'none',
    color: grey300,
  },
  actionIcon: {
    color: white,
    marginTop: -4,
  },
  actionHoverStyle: {
    backgroundColor: '#999',
  },
}

// use functional component style for representational components
export default sizeMe({ monitorWidth: true, monitorHeight: true }) (
withRouter(connect(mapStateToProps, mapDispatchToProps) (
class WorkloadsPage extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      actionsOpen: false,
      deleteOpen: false,
      scaleOpen: false,
      suspendOpen: false,
      hoveredRow: -1,
      hoveredResources: null,
      selectedResources: [],
      openTerminalOnDetach: true,
    }
    this.selectedIds = {}
    this.deleteEnabled = false
    this.suspendEnabled = false
    this.rows = this.resourcesToRows(props.resources, props.kinds)
    this.columns = [
      {
        id: 'kind',
        label: 'kind',
        sortable: true,
        headerStyle: styles.header,
        style: { ...styles.cell,
          width: '100px',
        }
      },
      {
        id: 'name',
        label: 'name',
        sortable: true,
        headerStyle: styles.header,
        style: { ...styles.cell,
          // width: '35%',
        },
      },
      {
        id: 'namespace',
        label: 'ns',
        sortable: true,
        headerStyle: styles.header,
        style: { ...styles.cell,
          width: 100,
        }
      },
      {
        id: 'cpu_utilized',
        label: <div><span>cpu</span><br/><span>used</span></div>,
        sortable: true,
        isNumeric: true,
        headerStyle: {...styles.header,
          textAlign: 'center',
          whiteSpace: 'normal',
          lineHeight: '13px',
          padding: 0,
        },
        style: { ...styles.cell,
          width: '7%',
          textAlign: 'right',
          paddingRight: '2%',
        },
      },
      {
        id: 'mem_utilized',
        label: <div><span>Gi mem</span><br/><span>used</span></div>,
        sortable: true,
        isNumeric: true,
        headerStyle: {...styles.header,
          textAlign: 'center',
          whiteSpace: 'normal',
          lineHeight: '13px',
          padding: 0,
        },
        style: { ...styles.cell,
          width: '7%',
          textAlign: 'right',
          paddingRight: '2%',
        },
      },
      {
        id: 'disk_utilized',
        label: <div><span>Gi disk</span><br/><span>used</span></div>,
        sortable: true,
        isNumeric: true,
        headerStyle: {...styles.header,
          textAlign: 'center',
          whiteSpace: 'normal',
          lineHeight: '13px',
          padding: 0,
        },
        style: { ...styles.cell,
          width: '7%',
          textAlign: 'right',
          paddingRight: '2%',
        },
      },
      {
        id: 'pods',
        label: 'pods',
        sortable: true,
        isNumeric: true,
        headerStyle: styles.header,
        style: { ...styles.cell,
          width: '7%',
          paddingLeft: '1%'
        }
      },
      {
        id: 'status',
        label: 'status',
        headerStyle: styles.header,
        style: { ...styles.cell,
          width: '7%',
          verticalAlign: 'middle',
          textAlign: 'center',
          paddingLeft: '1%',
        },
        sortable: true,
        comparator: compareStatuses,
      },
      {
        id: 'age',
        label: 'age',
        sortable: true,
        headerStyle: {...styles.header,
          textAlign: 'center',
        },
        style: { ...styles.cell,
          width: '10%',
          textAlign: 'center',
        }
      },
      {
        id: 'actions',
        label: 'actions ',
        headerStyle: {...styles.header,
          paddingLeft: 0,
        },
        style: { ...styles.cell,
          width: 55,
          lineHeight: '50px',
        },
        className: 'resource-actions',
      },
    ]
    for (let fn of [
      'renderCell',
      'getCellValue',
      'handleRowSelection',
      'handleCellClick',
      'handleDelete',
    ]) {
      this[fn] = this[fn].bind(this)
    }
  }

  resourcesToRows = (resources, kinds) => {
    if (!this.kinds || Object.keys(this.kinds).length === 0) {
      this.kinds = kindsByResourceGroup(kinds, 'workloads')
    }
    return Object.values(resources).filter(el => !el.isFiltered && (el.kind in this.kinds || !(el.kind in kinds)))
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    return !arraysEqual(this.props.filterNames, nextProps.filterNames)
      || !arraysEqual(this.props.autocomplete, nextProps.autocomplete)
      || this.props.resourceRevision !== nextProps.resourceRevision
      || this.props.metricsRevision !== nextProps.metricsRevision
      || this.state.actionsOpen !== nextState.actionsOpen
      || this.state.hoveredRow !== nextState.hoveredRow
      || this.props.resources !== nextProps.resources
      || this.state.deleteOpen !== nextState.deleteOpen
      || this.state.suspendOpen !== nextState.suspendOpen
      || this.state.scaleOpen !== nextState.scaleOpen
      || this.props.kinds !== nextProps.kinds
  }

  toggleOpenTerminalOnDetach = () => {
    this.setState({
      openTerminalOnDetach: !this.state.openTerminalOnDetach,
    })
  }

  handleActionsRequestClose = () => {
    this.setState({
      actionsOpen: false,
      hoveredRow: -1,
      hoveredResource: null,
    })
  }

  handleRowSelection = (selectedIds) => {
    if (!this.actionsClicked) {
      this.selectedIds = selectedIds
      this.deleteEnabled = !objectEmpty(selectedIds)
      this.suspendEnabled = anySelectedWithReplicas(selectedIds, this.props.resources)
      this.deleteButton.setDisabled(!this.deleteEnabled)
      this.suspendButton.setDisabled(!this.suspendEnabled)
    }
  }

  handleCellClick = (rowId, colId, resource, col) => {
    this.actionsClicked = false
    if (col.id === 'actions') {
      let trs = document.getElementsByClassName('workloads filter-table')[1].children[0].children
      let that = this
      this.props.accessEvaluator.getObjectAccess(resource, 'workloads').then((access) => {
        that.setState({
          actionsOpen: true,
          actionsAnchor: trs[rowId].children[colId+1],
          hoveredRow: rowId,
          hoveredResource: resource,
          hoveredResourceAccess: access,
        })
      })

      this.actionsClicked = true
      return false
    } else {
      this.props.viewResource(resource)
      return false
    }
  }

  handleDelete = (resource) => {
    let resources = []
    if (resource && 'kind' in resource) {
      resources.push(resource)
    } else if (this.selectedIds && Object.keys(this.selectedIds).length > 0) {
      for (let id in this.selectedIds) {
        resources.push(this.props.resources[id])
      }
    }

    this.setState({
      selectedResources: resources,
      deleteOpen: true,
      actionsOpen: false,
    })
  }

  handleSuspend = (resource) => {
    let resources = []
    if (resource) {
      resources.push(resource)
    } else if (this.selectedIds && Object.keys(this.selectedIds).length > 0) {
      for (let id in this.selectedIds) {
        let resource = this.props.resources[id]
        if ('replicas' in resource.spec && resource.spec.replicas > 0) {
          resources.push(resource)
        }
      }
    }
    this.setState({
      selectedResources: resources,
      suspendOpen: true,
      actionsOpen: false,
    })
  }

  handleScale = () => {
    this.setState({
      scaleOpen: true,
      actionsOpen: false,
    })
  }

  handleDetach = (resource) => {
    let resources = []
    if (resource) {
      resources.push(resource)
    } else if (this.selectedIds && Object.keys(this.selectedIds).length > 0) {
      for (let id in this.selectedIds) {
        resources.push(this.props.resources[id])
      }
    }

    this.setState({
      selectedResources: resources,
      detachOpen: true,
      actionsOpen: false,
    })
  }

  handleRequestCloseDetach = () => {
    this.setState({
      detachOpen: false,
      selectedResources: [],
    })
  }

  handleRequestCloseDelete = () => {
    this.setState({
      deleteOpen: false,
      selectedResources: [],
    })
  }

  handleConfirmDelete = () => {
    this.props.removeResource(...this.state.selectedResources)
    this.setState({
      selectedResources: [],
      deleteOpen: false,
    })
    this.handleRowSelection({})
  }

  handleConfirmDetach = () => {
    this.props.detachResource(...this.state.selectedResources)
    this.setState({
      selectedResources: [],
      detachOpen: false,
    })
    this.handleRowSelection({})
  }

  handleRequestCloseScale = () => {
    this.setState({
      scaleOpen: false,
      hoveredRow: -1,
    })
  }

  handleConfirmScale = (replicas) => {
    this.setState({
      scaleOpen: false,
    })
    if (replicas !== undefined) {
      this.props.scaleResource(this.state.hoveredResource, replicas)
    }
  }

  handleRequestCloseSuspend = () => {
    this.setState({
      suspendOpen: false,
    })
  }

  handleConfirmSuspend = () => {
    this.setState({
      suspendOpen: false,
    })
    for (let resource of this.state.selectedResources) {
      this.props.scaleResource(resource, 0)
    }
    this.handleRowSelection({})
    this.actionsClicked = false
  }

  // componentWillUpdate = () => {
  //   setTimeout(() => {
  //     Perf.start()
  //   }, 0)
  // }

  componentDidUpdate = () => {
    // Perf.stop()
    // let m = Perf.getLastMeasurements()
    // Perf.printWasted(m)

    if (!this.state.actionsOpen) {
      this.actionsClicked = false
    }
  }

  componentWillReceiveProps = (nextProps) => {
    this.rows = this.resourcesToRows(nextProps.resources, nextProps.kinds)
    this.setState({filters: nextProps.filters})
  }

  renderCell = (column, row) => {
    return renderResourceCell(column, row, this.props.podMetrics)
  }

  getCellValue = (column, row) => {
    return getResourceCellValue(column, row, this.props.podMetrics)
  }

  render() {
    let { props } = this

    return (
      <Paper style={styles.paper} className={'workloads-page'}>
        
        <FilterBox
          addFilter={props.addFilter} 
          removeFilter={props.removeFilter}
          filterNames={props.filterNames}
          autocomplete={props.autocomplete}
          />

        <FilteredResourceCountsPanel resources={props.resources} kinds={this.kinds}/>

        <FilterTable
          className={'workloads'}
          columns={this.columns}
          data={this.rows}
          height={'calc(100vh - 364px)'}
          multiSelectable={true}
          revision={`${props.resourceRevision}-${props.metricsRevision}`}
          onRowSelection={this.handleRowSelection}
          onCellClick={this.handleCellClick}
          hoveredRow={this.state.hoveredRow}
          onRenderCell={this.renderCell}
          getCellValue={this.getCellValue}
          selectedIds={this.selectedIds}
          stripedRows={false}
          iconStyle={{fill: 'rgba(255,255,255,0.9)'}}
          iconInactiveStyle={{fill: 'rgba(255,255,255,0.5)'}}
          width={'calc(100vw - 60px)'}
          wrapperStyle={{marginLeft: -15, marginRight: -15, overflowX: 'hidden', overflowY: 'auto'}}
          headerStyle={{backgroundColor: 'rgba(28,84,178,0.8)', color: 'white'}}
          />

        <RowActionMenu
          open={!!this.state.hoveredResource}
          handlers={{
            logs: ()=> { this.props.viewResource(this.state.hoveredResource,'logs') },
            terminal: ()=> { this.props.viewResource(this.state.hoveredResource,'terminal') },
            suspend: ()=>{ this.handleSuspend(this.state.hoveredResource)},
            scale: this.handleScale,
            edit: ()=> { this.props.viewResource(this.state.hoveredResource,'edit') },
            delete: ()=>{ this.handleDelete(this.state.hoveredResources)},
            detach: ()=> { this.handleDetach(this.state.hoveredResource)},
            close: this.handleActionsRequestClose,
          }}
          access={this.state.hoveredResourceAccess}
          anchorEl={this.state.actionsAnchor}
          />

        <Link to="/workloads/new" >
          <FloatingActionButton className={'new-workload'} style={styles.newResourceButton} backgroundColor={blueA400}>
            <IconAdd />
          </FloatingActionButton>
        </Link>

        <MultiResourceActionButton backgroundColor={red900} 
          mini={true} 
          style={styles.deleteResourceButton} 
          disabled={!this.deleteEnabled}
          onTouchTap={this.handleDelete}
          ref={(ref)=>{this.deleteButton = ref}}
          data-rh={'Delete Selected...'}
          data-rh-at={'bottom'}>
            <IconDelete/>
        </MultiResourceActionButton>

        <MultiResourceActionButton backgroundColor={grey800} 
          mini={true} 
          style={styles.suspendResourceButton} 
          disabled={!this.suspendEnabled}
          onTouchTap={this.handleSuspend}
          ref={(ref)=>{this.suspendButton = ref}}
          data-rh={'Suspend Selected...'}
          data-rh-at={'bottom'}>
            <IconSuspend/>
        </MultiResourceActionButton>

        <ConfirmationDialog 
          open={this.state.deleteOpen}
          title={'Delete Resource(s):'}
          message={`Are you sure you want to delete the following ` +
           `${this.state.selectedResources.length > 1 ? this.state.selectedResources.length + ' ' : ''}` +
           `resource${this.state.selectedResources.length > 1 ? 's':''}?`}
          resources={this.state.selectedResources}
          onRequestClose={this.handleRequestCloseDelete}
          onConfirm={this.handleConfirmDelete}
          linkGenerator={this.props.linkGenerator}
          />
       
        <ConfirmationDialog 
          open={this.state.suspendOpen}
          title={'Suspend Resource(s):'}
          message={`Are you sure you want to suspend the following ` +
           `${this.state.selectedResources.length > 1 ? this.state.selectedResources.length + ' ' : ''}` +
           `resource${this.state.selectedResources.length > 1 ? 's':''} (by scaling to 0 replicas)?`}
          resources={this.state.selectedResources}
          onRequestClose={this.handleRequestCloseSuspend}
          onConfirm={this.handleConfirmSuspend}
          linkGenerator={this.props.linkGenerator}
          />

        <ConfirmationDialog 
          open={this.state.detachOpen}
          title={'Detach Resource:'}
          message={`Are you sure you want to detach the following resource?`}
          resources={this.state.selectedResources}
          onRequestClose={this.handleRequestCloseDetach}
          onConfirm={this.handleConfirmDetach}
          linkGenerator={this.props.linkGenerator}
          >
          <p>
            This object will no longer count among the replicas for it's owner.
            <br/>
            Note: You can view "detached" resources in the workloads view by adding the filter 'detached:true'
          </p>
          <Checkbox
            label="Open terminal view"
            className={'open-term'}
            checked={this.state.openTerminalOnDetach}
            onCheck={this.toggleOpenTerminalOnDetach}
            style={styles.checkbox}
            labelStyle={styles.checkboxLabel}
          />
        </ConfirmationDialog>

        <ScaleDialog 
          open={this.state.scaleOpen}
          resource={this.state.hoveredResource}
          onRequestClose={this.handleRequestCloseScale}
          onConfirm={this.handleConfirmScale}
          />

      </Paper>
    )
  }
})))
