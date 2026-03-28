#!/usr/bin/env python

"""Module based allowed search, sort and order attributes"""

from enum import Enum


class Ordering(Enum):
    asc: str = "asc"
    desc: str = "desc"


class UserSearch(Enum):
    first_name: str = "first_name"
    last_name: str = "last_name"
    email: str = "email"
    address: str = "address"
    city: str = "city"
    state: str = "state"
    zip_code: str = "zip_code"
    phone_number: str = "phone_number"
    role_id: str = "role_id"
    role_display_name: str = "role_display_name"
    is_active: str = "is_active"


class UserSort(Enum):
    first_name: str = "first_name"
    last_name: str = "last_name"
    email: str = "email"
    is_active: str = "is_active"
    created_at: str = "created_at"
    updated_at: str = "updated_at"


class UserPolicySearch(Enum):
    user_id: str = "user_id"
    created_by: str = "created_by"


class UserPolicySort(Enum):
    user_id: str = "user_id"
    created_at: str = "created_at"
    updated_at: str = "updated_at"


class TagSearch(Enum):
    name: str = "name"
    slug: str = "slug"
    created_by: str = "created_by"


class TagSort(Enum):
    name: str = "name"
    slug: str = "slug"
    created_at: str = "created_at"
    updated_at: str = "updated_at"


class FileSearch(Enum):
    name: str = "name"
    description: str = "description"
    type: str = "type"
    created_by: str = "created_by"


class FileSort(Enum):
    name: str = "name"
    type: str = "type"
    created_at: str = "created_at"
    updated_at: str = "updated_at"


class UserTaskSearch(Enum):
    title: str = "title"
    due_date: str = "due_date"
    priority: str = "priority"
    is_active: str = "is_active"
    status: str = "status"
    start_date: str = "start_date"
    completion_date: str = "completion_date"


class UserTaskSort(Enum):
    title: str = "title"
    priority: str = "priority"
    status: str = "status"
    start_date: str = "start_date"
    completion_date: str = "completion_date"
    created_at: str = "created_at"
    updated_at: str = "updated_at"


class LeadSearch(Enum):
    loss_date: str = "loss_date"
    peril: str = "peril"
    insurance_company: str = "insurance_company"
    policy_number: str = "policy_number"
    claim_number: str = "claim_number"
    status: str = "status"
    source: str = "source"
    source_info: str = "source_info"
    instructions_or_notes: str = "instructions_or_notes"
    assigned_to: str = "assigned_to"
    client_id: str = "client_id"
    ref_number: str = "ref_number"
    ref_string: str = "ref_string"
    client_full_name: str = "full_name"
    client_full_name_alt: str = "full_name_alt"
    client_email: str = "email"
    client_email_alt: str = "email_alt"
    client_phone_number: str = "phone_number"
    client_phone_number_alt: str = "phone_number_alt"
    client_address: str = "address"
    client_city: str = "city"
    client_state: str = "state"
    client_zip_code: str = "zip_code"
    client_address_loss: str = "address_loss"
    client_city_loss: str = "city_loss"
    client_state_loss: str = "state_loss"
    client_zip_code_loss: str = "zip_code_loss"
    assigned_user_name: str = "assigned_user_name"
    assigned_user_email: str = "assigned_user_email"
    created_at: str = "created_at"
    updated_at: str = "updated_at"


class LeadSort(Enum):
    ref_number: str = "ref_number"
    loss_date: str = "loss_date"
    peril: str = "peril"
    status: str = "status"
    source: str = "source"
    created_at: str = "created_at"
    updated_at: str = "updated_at"


class LeadCommentSort(Enum):
    text: str = "text"
    created_at: str = "created_at"
    updated_at: str = "updated_at"


class LeadFileSort(Enum):
    name: str = "name"
    description: str = "description"
    type: str = "type"
    size: str = "size"
    created_at: str = "created_at"
    updated_at: str = "updated_at"


class LeadTaskSort(Enum):
    title: str = "title"
    description: str = "description"
    due_date: str = "due_date"
    priority: str = "priority"
    task_type: str = "task_type"
    status: str = "status"
    start_date: str = "start_date"
    completion_date: str = "completion_date"
    created_at: str = "created_at"
    updated_at: str = "updated_at"


class ClientSearch(Enum):
    full_name: str = "full_name"
    email: str = "email"
    phone_number: str = "phone_number"
    full_name_alt: str = "full_name_alt"
    email_alt: str = "email_alt"
    phone_number_alt: str = "phone_number_alt"
    organization: str = "organization"
    address: str = "address"
    city: str = "city"
    state: str = "state"
    zip_code: str = "zip_code"
    ref_number: str = "ref_number"
    ref_string: str = "ref_string"
    belonged_user_name: str = "belonged_user_name"
    belonged_user_email: str = "belonged_user_email"
    created_at: str = "created_at"
    updated_at: str = "updated_at"


class ClientSort(Enum):
    ref_number: str = "ref_number"
    full_name: str = "full_name"
    phone_number: str = "phone_number"
    email: str = "email"
    address: str = "address"
    belongs_to_user_name: str = "belongs_to_user_name"
    city: str = "city"
    state: str = "state"
    zip_code: str = "zip_code"
    created_at: str = "created_at"
    updated_at: str = "updated_at"
    created_by_username: str = "created_by_username"


class ClientCommentSort(Enum):
    text: str = "text"
    created_at: str = "created_at"
    updated_at: str = "updated_at"


class ClientFileSort(Enum):
    name: str = "name"
    description: str = "description"
    type: str = "type"
    size: str = "size"
    created_at: str = "created_at"
    updated_at: str = "updated_at"


class ClientTaskSort(Enum):
    title: str = "title"
    description: str = "description"
    due_date: str = "due_date"
    priority: str = "priority"
    task_type: str = "task_type"
    status: str = "status"
    start_date: str = "start_date"
    completion_date: str = "completion_date"
    created_at: str = "created_at"
    updated_at: str = "updated_at"


class ClaimSearch(Enum):
    loss_date: str = "loss_date"
    peril: str = "peril"
    insurance_company: str = "insurance_company"
    policy_number: str = "policy_number"
    policy_type: str = "policy_type"
    date_logged: str = "date_logged"
    anticipated_amount: str = "anticipated_amount"
    fee_type: str = "fee_type"
    fee: str = "fee"
    claim_number: str = "claim_number"
    current_phase: str = "current_phase"
    source: str = "source"
    source_info: str = "source_info"
    signed_by: str = "signed_by"
    adjusted_by: str = "adjusted_by"
    instructions_or_notes: str = "instructions_or_notes"
    assigned_to: str = "assigned_to"
    client_id: str = "client_id"
    ref_number: str = "ref_number"
    ref_string: str = "ref_string"
    client_name: str = "client_name"
    client_name_alt: str = "client_name_alt"
    client_email: str = "client_email"
    client_email_alt: str = "client_email_alt"
    client_phone: str = "client_phone"
    client_phone_alt: str = "client_phone_alt"
    address_loss: str = "address_loss"
    city_loss: str = "city_loss"
    state_loss: str = "state_loss"
    zip_code_loss: str = "zip_code_loss"
    sourced_user_name: str = "sourced_user_name"
    signed_user_name: str = "signed_user_name"
    adjusted_user_name: str = "adjusted_user_name"
    assigned_user_name: str = "assigned_user_name"
    assigned_user_email: str = "assigned_user_email"
    created_at: str = "created_at"
    updated_at: str = "updated_at"


class ClaimSort(Enum):
    ref_number: str = "ref_number"
    full_name: str = "full_name"
    loss_address: str = "address_loss"
    phone_number: str = "phone_number"
    email: str = "email"
    loss_date: str = "loss_date"
    peril: str = "peril"
    anticipated_amount: str = "anticipated_amount"
    fee: str = "fee"
    current_phase: str = "current_phase"
    sourced_user_full_name: str = "sourced_user_full_name"
    signed_user_full_name: str = "signed_user_full_name"
    adjusted_user_full_name: str = "adjusted_user_full_name"
    assigned_user_full_name: str = "assigned_user_full_name"
    insurance_company: str = "insurance_company"
    policy_number: str = "policy_number"
    policy_type: str = "policy_type"
    claim_number: str = "claim_number"
    created_at: str = "created_at"
    updated_at: str = "updated_at"


class ClaimCommentSort(Enum):
    text: str = "text"
    created_at: str = "created_at"
    updated_at: str = "updated_at"


class ClaimFileSort(Enum):
    name: str = "name"
    description: str = "description"
    type: str = "type"
    size: str = "size"
    created_at: str = "created_at"
    updated_at: str = "updated_at"


class ClaimTaskSort(Enum):
    title: str = "title"
    description: str = "description"
    due_date: str = "due_date"
    priority: str = "priority"
    task_type: str = "task_type"
    status: str = "status"
    start_date: str = "start_date"
    completion_date: str = "completion_date"
    created_at: str = "created_at"
    updated_at: str = "updated_at"


class ClaimPaymentSort(Enum):
    payment_date: str = "payment_date"
    created_at: str = "created_at"
    updated_at: str = "updated_at"


class NPOInitiativeSearch(Enum):
    title: str = "title"
    target: str = "target"
    mission: str = "mission"
    search_term: str = "search_term"
    is_active: str = "is_active"
    created_by: str = "created_by"


class NPOInitiativeSort(Enum):
    title: str = "title"
    is_active: str = "is_active"
    created_at: str = "created_at"
    updated_at: str = "updated_at"


class PartnershipSearch(Enum):
    title: str = "title"
    target: str = "target"
    mission: str = "mission"
    search_term: str = "search_term"
    is_active: str = "is_active"
    created_by: str = "created_by"


class PartnershipSort(Enum):
    title: str = "title"
    is_active: str = "is_active"
    created_at: str = "created_at"
    updated_at: str = "updated_at"


class NetworkSearch(Enum):
    title: str = "title"
    environment: str = "environment"
    summary: str = "summary"
    exploration_term: str = "exploration_term"
    is_active: str = "is_active"
    created_by: str = "created_by"


class NetworkSort(Enum):
    title: str = "title"
    environment: str = "environment"
    is_active: str = "is_active"
    created_at: str = "created_at"
    updated_at: str = "updated_at"


class NewsletterSearch(Enum):
    title: str = "title"
    content: str = "content"
    publication_date: str = "publication_date"
    is_featured: str = "is_featured"
    created_by: str = "created_by"


class NewsletterSort(Enum):
    title: str = "title"
    publication_date: str = "publication_date"
    created_at: str = "created_at"
    updated_at: str = "updated_at"


class AnnouncementSearch(Enum):
    title: str = "title"
    content: str = "content"
    announcement_date: str = "announcement_date"
    expiration_date: str = "expiration_date"


class AnnouncementSort(Enum):
    title: str = "title"
    announcement_date: str = "announcement_date"
    expiration_date: str = "expiration_date"
    created_at: str = "created_at"
    updated_at: str = "updated_at"


class TemplateFileSearch(Enum):
    name: str = "name"
    description: str = "description"
    state: str = "state"


class TemplateFileSort(Enum):
    name: str = "name"
    description: str = "description"
    state: str = "state"
    type: str = "type"
    size: str = "size"
    created_at: str = "created_at"
    updated_at: str = "updated_at"
