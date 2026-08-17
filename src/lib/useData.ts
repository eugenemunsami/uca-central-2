import { useCallback, useEffect, useState } from 'react'
import { repo, subscribe } from './repo'
import type {
  Aggregator, BeneficiaryEvent, BeneficiaryView, CatalogueItem, Comm, EscalationView, EscalationEvent,
  EscSuggestion, InterventionView, Notification, Profile, RagOverride, Sponsor, UserEvent, WeeklyUpdate,
  OnboardingView, OnboardingEvent, WelcomeParty, WelcomePartyInvite, InternalTaskView,
} from './types'

export interface Data {
  beneficiaries: BeneficiaryView[]
  interventions: InterventionView[]
  updates: WeeklyUpdate[]
  comms: Comm[]
  escalations: EscalationView[]
  escalationEvents: EscalationEvent[]
  benEvents: BeneficiaryEvent[]
  userEvents: UserEvent[]
  notifications: Notification[]
  suggestions: EscSuggestion[]
  overrides: RagOverride[]
  catalogue: CatalogueItem[]
  people: Profile[]
  aggregators: Aggregator[]
  sponsors: Sponsor[]
  onboardings: OnboardingView[]
  welcomeParties: WelcomeParty[]
  welcomePartyInvites: WelcomePartyInvite[]
  onboardingEvents: OnboardingEvent[]
  tasks: InternalTaskView[]
  loading: boolean
  reload: () => void
}

const empty: Omit<Data, 'loading' | 'reload'> = {
  beneficiaries: [], interventions: [], updates: [], comms: [],
  escalations: [], escalationEvents: [], benEvents: [], userEvents: [], notifications: [], suggestions: [],
  overrides: [], catalogue: [], people: [],
  aggregators: [], sponsors: [],
  onboardings: [], welcomeParties: [], welcomePartyInvites: [], onboardingEvents: [], tasks: [],
}

export function useData(): Data {
  const [state, setState] = useState(empty)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    Promise.all([
      repo.beneficiaries(), repo.interventions(), repo.updates(), repo.comms(),
      repo.escalations(), repo.escalationEvents(), repo.benEvents(), repo.userEvents(), repo.notifications(),
      repo.suggestedEscalations(), repo.overrides(), repo.catalogue(), repo.profiles(), repo.orgs(),
      repo.onboardings(), repo.welcomeParties(), repo.welcomePartyInvites(), repo.onboardingEvents(),
      repo.tasks(),
    ])
      .then(([beneficiaries, interventions, updates, comms, escalations, escalationEvents,
              benEvents, userEvents, notifications, suggestions, overrides, catalogue, people, orgs,
              onboardings, welcomeParties, welcomePartyInvites, onboardingEvents, tasks]) =>
        setState({
          beneficiaries, interventions, updates, comms,
          escalations, escalationEvents, benEvents, userEvents, notifications, suggestions,
          overrides, catalogue, people,
          aggregators: orgs.aggregators, sponsors: orgs.sponsors,
          onboardings, welcomeParties, welcomePartyInvites, onboardingEvents, tasks,
        }))
      .catch(() => setState(empty))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    reload()
    const unsub = subscribe(reload)
    return () => { unsub() }
  }, [reload])

  return { ...state, loading, reload }
}
