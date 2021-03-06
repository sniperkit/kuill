import React from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { blueA400, grey600 } from 'material-ui/styles/colors'
import './UtilizationPieChart.css'

export default class UtilizationPieChart extends React.PureComponent {

  render() {
    let { total, used, label, percent } = this.props

    // if (!total) {
    //   return null
    // }
    let data = []
    let value = 0
    
    let pct = 0
    if (total > 0) {
      if (percent) {
        pct = (100 * used / total)
        if (pct < 0.1) {
          pct = pct.toFixed(2).substr(1)
        } else if (pct < 1) {
          pct = pct.toFixed(1)
        } else {
          pct = Math.round(pct)
        }
        value = pct
      } else {
        value = used
      }
      data = [
        {name: 'used', value: used},
        {name: 'free', value: (total - used)},
      ]
    } else {
      data = [
        {name: 'used', value: 0},
        {name: 'free', value: 100},
      ]
    }

    return (
      <div className={this.props.className} 
        style={{...this.props.style}} onTouchTap={this.props.onTouchTap} data-select-by={this.props['data-select-by']}>
          <ResponsiveContainer>
            <PieChart >
              <Pie
                innerRadius={35}
                outerRadius={42}
                data={data}
                fill="#8884d8"
                stroke="none">
                <Cell key={'used'} fill={blueA400}/>
                <Cell key={'free'} fill={grey600}/>
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="utilization">
            <div className={percent ? 'percentage' : 'used'}>{value}</div>
            <div className="label">{label}</div>
          </div>
      </div>
    )
  }
}