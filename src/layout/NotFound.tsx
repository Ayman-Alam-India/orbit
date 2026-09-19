import { Link } from 'react-router-dom'
import { paths } from '../routes'
import { Panel } from '../ui'

export function NotFound() {
  return (
    <Panel eyebrow="404" title="Nothing at these coordinates">
      <Link to={paths.global()}>Back to the globe</Link>
    </Panel>
  )
}
