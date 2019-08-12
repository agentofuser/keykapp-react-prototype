import * as Automerge from 'automerge'
import { last } from 'fp-ts/es6/Array'
import { head } from 'fp-ts/es6/NonEmptyArray'
import { Option } from 'fp-ts/es6/Option'
import produce from 'immer'
import { findKappById } from '../kapps'
import { stringClamper } from '../kitchensink/purefns'
import { zoomInto, zoomOutToRoot } from '../navigation'
import { newHuffmanRoot } from '../navigation/huffman'
import {
  AppAction,
  AppState,
  AppSyncRoot,
  AppTempRoot,
  Kapp,
  Waypoint,
} from '../types'

const placeholderText = `Formal epistemology uses formal methods from decision theory, logic, probability theory and computability theory to model and reason about issues of epistemological interest. Work in this area spans several academic fields, including philosophy, computer science, economics, and statistics. The focus of formal epistemology has tended to differ somewhat from that of traditional epistemology, with topics like uncertainty, induction, and belief revision garnering more attention than the analysis of knowledge, skepticism, and issues with justification.`

export function makeInitialAppState(): AppState {
  const initialHuffmanRoot = newHuffmanRoot({})

  const initialAppState: AppState = {
    syncRoot: Automerge.from({
      kappIdv0Log: [],
      currentBuffer: stringClamper(280)(placeholderText),
    }),
    tempRoot: { waypointBreadcrumbs: [initialHuffmanRoot] },
  }
  return initialAppState
}

export function currentWaypoint(state: AppState): Option<Waypoint> {
  const waypointOption = last(state.tempRoot.waypointBreadcrumbs)
  return waypointOption
}

export function logKappExecution(draftState: AppSyncRoot, kapp: Kapp): void {
  draftState.kappIdv0Log.push(kapp.idv0)
}

export function rootWaypoint(state: AppState): Waypoint {
  return head(state.tempRoot.waypointBreadcrumbs)
}

export function appReducer(prevState: AppState, action: AppAction): AppState {
  const [_keyswitch, waypoint] = action.data.keybinding
  const kappIdv0 = waypoint.value.kappIdv0
  const kapp = kappIdv0 && findKappById(kappIdv0)

  let nextSyncRoot = prevState.syncRoot
  if (kappIdv0 && kapp) {
    nextSyncRoot = Automerge.change(
      prevState.syncRoot,
      kappIdv0,
      (draftState: AppSyncRoot): void => {
        kapp.instruction(draftState, action)

        logKappExecution(draftState, kapp)
      }
    )

    let changes = Automerge.getChanges(prevState.syncRoot, nextSyncRoot)
    console.log(JSON.stringify(changes, null, 2))
  }

  const nextTempRoot = produce(
    prevState.tempRoot,
    (draftState: AppTempRoot): void => {
      if (!kappIdv0) {
        zoomInto(waypoint)(draftState, action)
      } else {
        // Update huffman tree based on kapp's updated weight calculated from
        // the kappLog
        draftState.waypointBreadcrumbs = [newHuffmanRoot({ state: prevState })]

        zoomOutToRoot(draftState, action)
      }
    }
  )

  const nextState =
    nextSyncRoot === prevState.syncRoot && nextTempRoot === prevState.tempRoot
      ? prevState
      : { syncRoot: nextSyncRoot, tempRoot: nextTempRoot }

  return nextState
}
