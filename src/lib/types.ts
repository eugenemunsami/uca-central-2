export type Role = 'exco' | 'manco' | 'consultant' | 'external'
export type Rag = 'green' | 'amber' | 'red'
export type Stage = 'onboarding' | 'diagnostic' | 'sow' | 'implementation' | 'monitoring' | 'completed'
export type IvStatus = 'not_started' | 'in_progress' | 'awaiting_beneficiary' | 'on_hold' | 'completed'
export type CloseoutStatus = 'none' | 'requested' | 'confirmed'
export type Channel = 'call' | 'email' | 'meeting' | 'whatsapp' | 'site_visit'

// Stage funnel excludes the pre-SOW stages (handled by the separate onboarding system).
export const STAGES: Stage[] = ['onboarding', 'diagnostic', 'sow', 'implementation', 'monitoring', 'completed']
export const FUNNEL_STAGES: Stage[] = ['implementation', 'monitoring', 'completed']
export const STAGE_LABEL: Record<Stage, string> = {
  onboarding: 'Onboarding', diagnostic: 'Diagnostic', sow: 'SOW',
  implementation: 'Implementation', monitoring: 'Monitoring', completed: 'Completed',
}
export const STATUS_LABEL: Record<IvStatus, string> = {
  not_started: 'Not started', in_progress: 'In progress',
  awaiting_beneficiary: 'Awaiting beneficiary', on_hold: 'On hold', completed: 'Completed',
}

export type UserStatus = 'pending' | 'active' | 'suspended' | 'deactivated' | 'invitation_expired'

export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  pending: 'Pending', active: 'Active', suspended: 'Suspended',
  deactivated: 'Deactivated', invitation_expired: 'Invitation expired',
}

export interface Profile {
  id: string
  full_name: string
  email: string
  role: Role
  discipline?: string | null
  is_admin: boolean
  active: boolean
  external_client_id?: string | null
  external_sponsor_id?: string | null
  organisation?: string | null
  job_title?: string | null
  status?: UserStatus
  invited_at?: string | null
  activated_at?: string | null
  invite_expires_at?: string | null
  created_by?: string | null
  temp_password?: string | null            // simulated in demo; real auth handles this at go-live
  terms_accepted_at?: string | null
  removed_at?: string | null               // admin soft-hide: hidden app-wide but kept in the database, restorable
  removed_by?: string | null
}

// Org structure: an Aggregator (e.g. BEE123) sits on top and can have many
// Sponsors under it. A Sponsor can also stand alone (aggregator_id = null).
// An aggregator that funds its own cohort has a Sponsor under it named after it.
export interface Aggregator { id: string; name: string }
export interface Sponsor { id: string; name: string; aggregator_id?: string | null }
// Kept as an alias so older imports still resolve; a "client" is a Sponsor (funder).
export type Client = Sponsor

export interface Director {
  name: string
  email?: string | null
  phone?: string | null
}

export interface CatalogueItem {
  id: string
  category: string
  name: string
  description?: string | null
  est_delivery?: string | null
  default_owner_id?: string | null
  active: boolean
}

// Beneficiary close-out lifecycle (separate from the reporting `stage`):
//  active            : work in progress
//  pending_closeout  : all interventions closed out -> in ManCo's "Close-outs to approve"
//  closeout_sent     : ManCo produced the POE report and sent it to the client
//  concluded         : client acknowledged; visible to client/exco/manco for the month
//  archived          : filed away after the month-end extract; can be re-onboarded
export type BeneLifecycle = 'active' | 'pending_closeout' | 'closeout_sent' | 'concluded' | 'archived'

export const LIFECYCLE_LABEL: Record<BeneLifecycle, string> = {
  active: 'Active',
  pending_closeout: 'Ready for close-out',
  closeout_sent: 'Close-out with client',
  concluded: 'Concluded',
  archived: 'Archived',
}

export interface Beneficiary {
  id: string
  name: string
  sponsor_id: string
  industry?: string | null
  contact_person?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  directors: Director[]
  stage: Stage
  project_manager_id?: string | null
  ember360_report_url?: string | null
  welcome_party_date?: string | null
  missed_welcome_parties: number
  sow_signed_date?: string | null
  sow_url?: string | null
  expected_completion?: string | null
  last_engagement_at?: string | null
  needs_onsite: boolean
  outstanding_items?: string | null
  rag_override?: Rag | null
  rag_override_reason?: string | null
  drive_folder_url?: string | null
  lifecycle: BeneLifecycle
  cycle: number                       // bumps each time a repeat beneficiary is re-onboarded
  closeout_report_url?: string | null
  closeout_return_notes?: string | null
  concluded_at?: string | null
  archived_at?: string | null
  removed_at?: string | null          // admin soft-hide: hidden app-wide but kept in the database, restorable
  removed_by?: string | null          // the user account that hid it
  created_at: string
}

export interface Intervention {
  id: string
  beneficiary_id: string
  kind: 'standard' | 'custom'
  catalogue_id?: string | null
  custom_name?: string | null
  custom_kind?: 'capex' | 'opex' | 'other' | null
  custom_budget?: number | null
  custom_motivation?: string | null
  consultant_id?: string | null
  status: IvStatus
  hold_reason?: string | null
  start_date?: string | null
  due_date?: string | null
  completed_at?: string | null
  awaiting_response_since?: string | null
  closeout_status: CloseoutStatus
  closeout_requested_by?: string | null
  closeout_requested_at?: string | null
  closeout_confirmed_by?: string | null
  closeout_confirmed_at?: string | null
  assigned_at?: string | null
  acknowledged: boolean
  acknowledged_at?: string | null
  closeout_subfolder_url?: string | null   // Drive subfolder with this intervention's outputs
  closeout_email_sent?: boolean            // consultant confirms the close-out email went to the beneficiary
  closeout_email_text?: string | null
  response_extended_until?: string | null  // allowable delay: pauses the red clock until this date
  cancelled?: boolean                      // soft-cancel (kept, but off the current-cycle board)
  removed_at?: string | null               // admin soft-hide: hidden app-wide but kept in the database, restorable
  removed_by?: string | null               // the user account that hid it
  cycle?: number                           // which re-onboard cycle this belongs to
  drive_folder_url?: string | null
  poe_url?: string | null
  closeout_report_url?: string | null
  rag_override?: Rag | null
  rag_override_reason?: string | null
  created_at: string
}

export interface WeeklyUpdate {
  id: string
  intervention_id: string
  author_id?: string | null
  completed_work?: string | null
  in_progress?: string | null
  blocker?: string | null
  blocker_owner?: string | null
  next_action?: string | null
  next_update_due?: string | null
  created_at: string
}

export interface Comm {
  id: string
  beneficiary_id: string
  intervention_id?: string | null
  author_id?: string | null
  channel: Channel
  occurred_at: string
  context: string
  followed_up_by_email: boolean
  email_text?: string | null
}

export type EscTrigger =
  | 'no_response_3_days' | 'sow_unsigned_7_days' | 'two_missed_welcome_parties'
  | 'pre_vetting_failed' | 'overdue' | 'manual'

// Escalation lifecycle (state machine):
//  suggested (computed, not stored)
//   -> pending_release   : raised, needs 2 different ManCo approvals before the client sees it
//   -> with_client       : released; client contacts can see/act; feedback clock runs
//   -> resolution_proposed: UCA has proposed a resolution; needs client + ManCo approval
//   -> awaiting_consultant: both approved; consultant/owner must acknowledge or reject
//   -> manco_review       : consultant rejected the resolution; back with ManCo
//   -> resolved           : consultant acknowledged; closed
// Ownership-baton escalation: the case's operational owner moves along the chain
// consultant -> chosen ManCo -> chosen Aggregator/Sponsor, and back up, until the
// consultant accepts. Only the current owner can act; everyone else sees it locked.
export type EscStatus =
  | 'with_manco'             // consultant escalated to a chosen ManCo
  | 'returned_to_consultant' // ManCo declined; consultant must accept or re-escalate
  | 'with_sponsor'           // ManCo escalated to an Aggregator/Sponsor recipient
  | 'returned_to_manco'      // sponsor declined; back with ManCo
  | 'resolution_submitted'   // sponsor submitted a proposed resolution; ManCo to review
  | 'outcome_to_consultant'  // ManCo returned the outcome; consultant must accept or re-escalate
  | 'resolved'

export type OwnerRole = 'consultant' | 'manco' | 'external'

export const ESC_STATUS_LABEL: Record<EscStatus, string> = {
  with_manco: 'With ManCo',
  returned_to_consultant: 'Escalation Returned',
  with_sponsor: 'Escalated to Aggregator/Sponsor',
  returned_to_manco: 'Returned by Aggregator/Sponsor',
  resolution_submitted: 'Resolution Submitted',
  outcome_to_consultant: 'Escalation Outcome Received',
  resolved: 'Resolved',
}

export interface Approval { user_id: string; at: string }

export interface Escalation {
  id: string
  intervention_id: string                   // escalations are per single intervention
  beneficiary_id: string
  reason: string                            // the original escalation reason
  context?: string | null                   // supporting info from the consultant
  status: EscStatus
  current_owner_id: string | null           // who must act now
  current_owner_role: OwnerRole
  consultant_id: string                     // the original consultant (constant)
  manco_id?: string | null                  // current / last ManCo in the chain
  sponsor_id?: string | null                // current / last Aggregator/Sponsor recipient
  participants: string[]                    // everyone who has owned/acted (read-only visibility)
  raised_by: string
  raised_at: string
  last_action_at: string
  resolved_at?: string | null
}

export type EscEventKind =
  | 'escalated_to_manco' | 'declined_to_consultant' | 'escalated_to_sponsor'
  | 'declined_to_manco' | 'resolution_submitted' | 'returned_to_consultant'
  | 'reescalated' | 'accepted' | 'contact_attempt' | 'note'

export const ESC_EVENT_LABEL: Record<EscEventKind, string> = {
  escalated_to_manco: 'Escalated to ManCo',
  declined_to_consultant: 'Declined & returned to consultant',
  escalated_to_sponsor: 'Escalated to Aggregator/Sponsor',
  declined_to_manco: 'Declined & returned to ManCo',
  resolution_submitted: 'Resolution submitted',
  returned_to_consultant: 'Outcome returned to consultant',
  reescalated: 'Re-escalated',
  accepted: 'Accepted & resumed',
  contact_attempt: 'Contact attempt logged',
  note: 'Note added',
}

// One row of the escalation's time-stamped Update History / Resolution Log.
export interface EscalationEvent {
  id: string
  escalation_id: string
  at: string
  user_id?: string | null                   // null = system
  kind: EscEventKind
  from_status?: EscStatus | null
  to_status?: EscStatus | null
  from_owner_id?: string | null
  to_owner_id?: string | null
  text?: string | null                       // reason / context / way-forward / resolution
}

// One row of a beneficiary's time-stamped activity log (mirrors escalation events).
export type BenEventKind =
  | 'loaded' | 'reonboarded' | 'edited' | 'intervention_added' | 'intervention_cancelled'
  | 'delay_granted' | 'closeout_requested' | 'closeout_confirmed' | 'closeout_returned'
  | 'closeout_report_sent' | 'concluded' | 'returned_by_client' | 'archived' | 'note'
  | 'removed' | 'restored'
  | 'intervention_removed' | 'intervention_restored' | 'intervention_deleted'

export const BEN_EVENT_LABEL: Record<BenEventKind, string> = {
  loaded: 'Beneficiary loaded',
  reonboarded: 'Re-onboarded (new SOW)',
  edited: 'Details edited',
  intervention_added: 'Intervention added',
  intervention_cancelled: 'Intervention cancelled',
  delay_granted: 'Allowable delay granted',
  closeout_requested: 'Intervention close-out requested',
  closeout_confirmed: 'Intervention close-out confirmed',
  closeout_returned: 'Intervention close-out returned',
  closeout_report_sent: 'Close-out report sent to client',
  concluded: 'Client acknowledged — concluded',
  returned_by_client: 'Client returned the close-out',
  archived: 'Archived',
  note: 'Note added',
  removed: 'Beneficiary hidden by admin',
  restored: 'Beneficiary restored by admin',
  intervention_removed: 'Intervention hidden by admin',
  intervention_restored: 'Intervention restored by admin',
  intervention_deleted: 'Intervention permanently deleted',
}

export type UserEventKind =
  | 'created' | 'invite_sent' | 'invite_resent' | 'activated' | 'password_reset_sent'
  | 'role_changed' | 'suspended' | 'reactivated' | 'deactivated' | 'invite_expired'
  | 'removed' | 'restored' | 'deleted'

export const USER_EVENT_LABEL: Record<UserEventKind, string> = {
  created: 'User created', invite_sent: 'Invitation sent', invite_resent: 'Invitation resent',
  activated: 'Account activated', password_reset_sent: 'Password reset sent',
  role_changed: 'Role / access changed', suspended: 'Suspended', reactivated: 'Reactivated',
  deactivated: 'Deactivated', invite_expired: 'Invitation expired',
  removed: 'Hidden by an admin', restored: 'Restored by an admin', deleted: 'Deleted by an admin',
}

export interface UserEvent {
  id: string
  target_user_id: string
  at: string
  by_user_id?: string | null
  kind: UserEventKind
  text?: string | null
}

export interface BeneficiaryEvent {
  id: string
  beneficiary_id: string
  at: string
  user_id?: string | null
  kind: BenEventKind
  text?: string | null
}

export type NotificationKind =
  | 'escalation_released' | 'feedback_missed' | 'resolution_ready'
  | 'resolution_rejected' | 'escalation_resolved' | 'assigned'
  | 'closeout_requested' | 'closeout_confirmed' | 'closeout_returned'
  | 'intervention_closed' | 'beneficiary_closeout_ready' | 'beneficiary_closeout_sent'
  | 'beneficiary_concluded' | 'beneficiary_returned' | 'sla_breach_internal' | 'delay_granted'

export interface Notification {
  id: string
  user_id: string
  at: string
  kind: NotificationKind
  text: string
  escalation_id?: string | null
  action_required?: boolean                  // true = you must act; false = for information
  read: boolean
}

// A computed suggestion (breach detected, not yet raised). Never stored.
export interface EscSuggestion {
  key: string
  beneficiary_id: string
  beneficiary_name: string
  intervention_id: string
  intervention_title: string
  trigger: EscTrigger
  reason: string
}

// Decorated escalation for the UI.
export interface EscalationView extends Escalation {
  beneficiary_name: string
  intervention_title: string
  client_id: string                          // top-level programme (aggregator/sponsor)
  owner_name: string | null
  owner_org: string | null
  consultant_name: string | null
  time_to_resolve_days: number | null
}

export interface RagOverride {
  id: string
  beneficiary_id: string
  rag: Rag
  reason: string
  effective_date: string
  logged_by?: string | null
  created_at: string
}

export interface InterventionView extends Intervention {
  rag: Rag
  rag_reason: string | null
  title: string
  category: string
  days_awaiting: number | null
  last_update_at: string | null
  consultant_name: string | null
  beneficiary_name: string
}

export interface BeneficiaryView extends Beneficiary {
  rag: Rag
  client_name: string          // top-level label: aggregator name, or standalone sponsor name
  client_id: string            // top-level id: aggregator id, or standalone sponsor id
  sponsor_name: string | null
  aggregator_id: string | null
  aggregator_name: string | null
  active_intervention_count: number    // excludes cancelled
  all_interventions_closed: boolean     // every active intervention confirmed closed
  recipient_ids: string[]               // external users who receive this beneficiary's close-out
  escalated: boolean
  escalation_reason: string | null
  intervention_count: number
  completed_count: number
  pm_name: string | null
  next_action: string | null
  last_update_at: string | null
}
