-- Generated from dump-pg16-automation_hub-202609041902-plain (1).sql
-- Run these files in order in the Cloud SQL query editor.

SET client_min_messages = warning;
SET standard_conforming_strings = on;


CREATE SCHEMA automation_hub;



CREATE TABLE automation_hub.alembic_version (
    version_num character varying(32) NOT NULL
);

CREATE TABLE automation_hub.ams_1l_cost (
    id integer NOT NULL,
    ams_year_id integer NOT NULL,
    annual_fee_eur numeric(14,2) NOT NULL,
    n_processes_baseline integer NOT NULL
);

CREATE SEQUENCE automation_hub.ams_1l_cost_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE automation_hub.ams_1l_cost_id_seq OWNED BY automation_hub.ams_1l_cost.id;

CREATE TABLE automation_hub.ams_2l_cost (
    id integer NOT NULL,
    ticket_id integer NOT NULL,
    company_id integer,
    closed_date date,
    cost_per_ticket_eur numeric(14,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE automation_hub.ams_2l_cost_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE automation_hub.ams_2l_cost_id_seq OWNED BY automation_hub.ams_2l_cost.id;

CREATE TABLE automation_hub.ams_rfc_cost (
    id integer NOT NULL,
    process_id integer,
    rfc_ref character varying(120),
    year integer NOT NULL,
    description text,
    man_days numeric(10,2),
    root_cause_raw text,
    note text,
    cost_eur numeric(14,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE automation_hub.ams_rfc_cost_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE automation_hub.ams_rfc_cost_id_seq OWNED BY automation_hub.ams_rfc_cost.id;

CREATE TABLE automation_hub.ams_year (
    id integer NOT NULL,
    code character varying(10) NOT NULL,
    ordinal integer NOT NULL,
    year integer
);

CREATE SEQUENCE automation_hub.ams_year_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE automation_hub.ams_year_id_seq OWNED BY automation_hub.ams_year.id;

CREATE TABLE automation_hub.app_user (
    id integer NOT NULL,
    sub character varying(255) NOT NULL,
    email character varying(320),
    preferred_username character varying(255),
    name character varying(255),
    given_name character varying(255),
    family_name character varying(255),
    role character varying(20) DEFAULT 'user'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_app_user_role CHECK (((role)::text = ANY (ARRAY[('user'::character varying)::text, ('editor'::character varying)::text, ('admin'::character varying)::text])))
);

CREATE SEQUENCE automation_hub.app_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE automation_hub.app_user_id_seq OWNED BY automation_hub.app_user.id;

CREATE TABLE automation_hub.application (
    id integer NOT NULL,
    name character varying(120) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE automation_hub.application_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE automation_hub.application_id_seq OWNED BY automation_hub.application.id;

CREATE TABLE automation_hub.apqc_category (
    id integer NOT NULL,
    pcf_id integer NOT NULL,
    hierarchy_id character varying(20) NOT NULL,
    name character varying(300) NOT NULL,
    description text
);

CREATE SEQUENCE automation_hub.apqc_category_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE automation_hub.apqc_category_id_seq OWNED BY automation_hub.apqc_category.id;

CREATE TABLE automation_hub.apqc_process (
    id integer NOT NULL,
    pcf_id integer NOT NULL,
    hierarchy_id character varying(20) NOT NULL,
    name character varying(300) NOT NULL,
    description text,
    process_group_id integer NOT NULL
);

CREATE TABLE automation_hub.apqc_process_group (
    id integer NOT NULL,
    pcf_id integer NOT NULL,
    hierarchy_id character varying(20) NOT NULL,
    name character varying(300) NOT NULL,
    description text,
    category_id integer NOT NULL
);

CREATE SEQUENCE automation_hub.apqc_process_group_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE automation_hub.apqc_process_group_id_seq OWNED BY automation_hub.apqc_process_group.id;

CREATE SEQUENCE automation_hub.apqc_process_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE automation_hub.apqc_process_id_seq OWNED BY automation_hub.apqc_process.id;

CREATE TABLE automation_hub.company (
    id integer NOT NULL,
    name character varying(120) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE automation_hub.company_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE automation_hub.company_id_seq OWNED BY automation_hub.company.id;

CREATE TABLE automation_hub.department (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE automation_hub.department_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE automation_hub.department_id_seq OWNED BY automation_hub.department.id;

CREATE TABLE automation_hub.idea (
    id integer NOT NULL,
    title character varying(300) NOT NULL,
    submitter_name character varying(200) NOT NULL,
    apqc_process_id integer NOT NULL,
    primary_goal character varying(60) NOT NULL,
    process_stability character varying(60) NOT NULL,
    system_stability character varying(60) NOT NULL,
    task_frequency character varying(20) NOT NULL,
    transaction_volume numeric(14,2) NOT NULL,
    headcount_fte numeric(10,2) NOT NULL,
    avg_time_per_task_minutes numeric(10,2) NOT NULL,
    error_rate_pct numeric(6,3) NOT NULL,
    avg_rework_time_minutes numeric(10,2) NOT NULL,
    audit_rate_pct numeric(6,3) NOT NULL,
    avg_loaded_fte_cost_eur numeric(14,2) NOT NULL,
    number_of_steps character varying(20) NOT NULL,
    decision_logic character varying(60) NOT NULL,
    process_variations character varying(30) NOT NULL,
    primary_input_format character varying(60) NOT NULL,
    number_of_systems character varying(10) NOT NULL,
    system_interface character varying(60) NOT NULL,
    unstructured_data character varying(60) NOT NULL,
    cognitive_reasoning character varying(60) NOT NULL,
    computer_vision character varying(60) NOT NULL,
    ai_output_risk character varying(60) NOT NULL,
    annual_transactions numeric(16,2) NOT NULL,
    base_hours numeric(16,2) NOT NULL,
    rework_hours numeric(16,2) NOT NULL,
    total_hours_saved numeric(16,2) NOT NULL,
    gross_roi_eur numeric(16,2) NOT NULL,
    feasibility_score integer NOT NULL,
    feasibility_band character varying(10) NOT NULL,
    technology_category character varying(60) NOT NULL,
    final_classification character varying(60) NOT NULL,
    status character varying(20) DEFAULT 'Submitted'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE automation_hub.idea_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE automation_hub.idea_id_seq OWNED BY automation_hub.idea.id;

CREATE TABLE automation_hub.license_cost (
    id integer NOT NULL,
    year integer NOT NULL,
    virtual_machine_id integer NOT NULL,
    cost_year_eur numeric(14,2) NOT NULL
);

CREATE SEQUENCE automation_hub.license_cost_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE automation_hub.license_cost_id_seq OWNED BY automation_hub.license_cost.id;

CREATE TABLE automation_hub.priority (
    id integer NOT NULL,
    value character varying(10) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE automation_hub.priority_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE automation_hub.priority_id_seq OWNED BY automation_hub.priority.id;

CREATE TABLE automation_hub.process (
    id integer NOT NULL,
    canonical_name character varying(300) NOT NULL,
    normalized_key character varying(300) NOT NULL,
    description text,
    department_id integer,
    status character varying(60),
    company_id integer,
    ams_year_id integer,
    go_live_date date,
    in_pipeline boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    documentation_url character varying(1000)
);

CREATE TABLE automation_hub.process_application (
    id integer NOT NULL,
    process_id integer NOT NULL,
    application_id integer NOT NULL
);

CREATE SEQUENCE automation_hub.process_application_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE automation_hub.process_application_id_seq OWNED BY automation_hub.process_application.id;

CREATE TABLE automation_hub.process_economics (
    id integer NOT NULL,
    process_id integer NOT NULL,
    capex_eur numeric(14,2) NOT NULL,
    roi_expected_yr integer,
    fte_hours_month_actual numeric(10,2) NOT NULL,
    extra_annual_saving_eur numeric(14,2) NOT NULL,
    note text
);

CREATE SEQUENCE automation_hub.process_economics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE automation_hub.process_economics_id_seq OWNED BY automation_hub.process_economics.id;

CREATE SEQUENCE automation_hub.process_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE automation_hub.process_id_seq OWNED BY automation_hub.process.id;

CREATE TABLE automation_hub.process_schedule (
    id integer NOT NULL,
    process_id integer NOT NULL,
    scheduled_description text,
    frequency text,
    run_time text,
    avg_minutes numeric(10,2),
    virtual_machine_id integer,
    run_user character varying(120),
    rpa_hours_month numeric(10,2),
    time_slot character varying(20) DEFAULT 'morning'::character varying NOT NULL
);

CREATE SEQUENCE automation_hub.process_schedule_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE automation_hub.process_schedule_id_seq OWNED BY automation_hub.process_schedule.id;

CREATE TABLE automation_hub.reference_variable (
    id integer NOT NULL,
    name character varying(120) NOT NULL,
    value numeric(14,4) NOT NULL,
    note text
);

CREATE SEQUENCE automation_hub.reference_variable_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE automation_hub.reference_variable_id_seq OWNED BY automation_hub.reference_variable.id;

CREATE TABLE automation_hub.root_cause (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE automation_hub.root_cause_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE automation_hub.root_cause_id_seq OWNED BY automation_hub.root_cause.id;

CREATE TABLE automation_hub.support_level (
    id integer NOT NULL,
    code character varying(10) NOT NULL,
    description text
);

CREATE SEQUENCE automation_hub.support_level_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE automation_hub.support_level_id_seq OWNED BY automation_hub.support_level.id;

CREATE TABLE automation_hub.tco_cost (
    id integer NOT NULL,
    cost_date date NOT NULL,
    cost_eur numeric(14,2) NOT NULL,
    cost_type character varying(10) NOT NULL,
    subtype character varying(60),
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE automation_hub.tco_cost_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE automation_hub.tco_cost_id_seq OWNED BY automation_hub.tco_cost.id;

CREATE TABLE automation_hub.ticket (
    id integer NOT NULL,
    ticket_id character varying(60) NOT NULL,
    ams_year_id integer,
    ticket_type character varying(60) NOT NULL,
    priority_id integer,
    process_id integer,
    requestor character varying(200),
    start_date date,
    end_date date,
    root_cause_id integer,
    is_1l boolean NOT NULL,
    company_id integer,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    support_level_id integer,
    ticket_color character varying(7)
);

CREATE SEQUENCE automation_hub.ticket_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE automation_hub.ticket_id_seq OWNED BY automation_hub.ticket.id;

CREATE TABLE automation_hub.virtual_machine (
    id integer NOT NULL,
    normalized_id character varying(60) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE automation_hub.virtual_machine_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE automation_hub.virtual_machine_id_seq OWNED BY automation_hub.virtual_machine.id;

CREATE TABLE automation_hub.vm_cost (
    id integer NOT NULL,
    year integer NOT NULL,
    virtual_machine_id integer NOT NULL,
    cost_eur numeric(14,2) NOT NULL
);

CREATE SEQUENCE automation_hub.vm_cost_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE automation_hub.vm_cost_id_seq OWNED BY automation_hub.vm_cost.id;

ALTER TABLE ONLY automation_hub.ams_1l_cost ALTER COLUMN id SET DEFAULT nextval('automation_hub.ams_1l_cost_id_seq'::regclass);

ALTER TABLE ONLY automation_hub.ams_2l_cost ALTER COLUMN id SET DEFAULT nextval('automation_hub.ams_2l_cost_id_seq'::regclass);

ALTER TABLE ONLY automation_hub.ams_rfc_cost ALTER COLUMN id SET DEFAULT nextval('automation_hub.ams_rfc_cost_id_seq'::regclass);

ALTER TABLE ONLY automation_hub.ams_year ALTER COLUMN id SET DEFAULT nextval('automation_hub.ams_year_id_seq'::regclass);

ALTER TABLE ONLY automation_hub.app_user ALTER COLUMN id SET DEFAULT nextval('automation_hub.app_user_id_seq'::regclass);

ALTER TABLE ONLY automation_hub.application ALTER COLUMN id SET DEFAULT nextval('automation_hub.application_id_seq'::regclass);

ALTER TABLE ONLY automation_hub.apqc_category ALTER COLUMN id SET DEFAULT nextval('automation_hub.apqc_category_id_seq'::regclass);

ALTER TABLE ONLY automation_hub.apqc_process ALTER COLUMN id SET DEFAULT nextval('automation_hub.apqc_process_id_seq'::regclass);

ALTER TABLE ONLY automation_hub.apqc_process_group ALTER COLUMN id SET DEFAULT nextval('automation_hub.apqc_process_group_id_seq'::regclass);

ALTER TABLE ONLY automation_hub.company ALTER COLUMN id SET DEFAULT nextval('automation_hub.company_id_seq'::regclass);

ALTER TABLE ONLY automation_hub.department ALTER COLUMN id SET DEFAULT nextval('automation_hub.department_id_seq'::regclass);

ALTER TABLE ONLY automation_hub.idea ALTER COLUMN id SET DEFAULT nextval('automation_hub.idea_id_seq'::regclass);

ALTER TABLE ONLY automation_hub.license_cost ALTER COLUMN id SET DEFAULT nextval('automation_hub.license_cost_id_seq'::regclass);

ALTER TABLE ONLY automation_hub.priority ALTER COLUMN id SET DEFAULT nextval('automation_hub.priority_id_seq'::regclass);

ALTER TABLE ONLY automation_hub.process ALTER COLUMN id SET DEFAULT nextval('automation_hub.process_id_seq'::regclass);

ALTER TABLE ONLY automation_hub.process_application ALTER COLUMN id SET DEFAULT nextval('automation_hub.process_application_id_seq'::regclass);

ALTER TABLE ONLY automation_hub.process_economics ALTER COLUMN id SET DEFAULT nextval('automation_hub.process_economics_id_seq'::regclass);

ALTER TABLE ONLY automation_hub.process_schedule ALTER COLUMN id SET DEFAULT nextval('automation_hub.process_schedule_id_seq'::regclass);

ALTER TABLE ONLY automation_hub.reference_variable ALTER COLUMN id SET DEFAULT nextval('automation_hub.reference_variable_id_seq'::regclass);

ALTER TABLE ONLY automation_hub.root_cause ALTER COLUMN id SET DEFAULT nextval('automation_hub.root_cause_id_seq'::regclass);

ALTER TABLE ONLY automation_hub.support_level ALTER COLUMN id SET DEFAULT nextval('automation_hub.support_level_id_seq'::regclass);

ALTER TABLE ONLY automation_hub.tco_cost ALTER COLUMN id SET DEFAULT nextval('automation_hub.tco_cost_id_seq'::regclass);

ALTER TABLE ONLY automation_hub.ticket ALTER COLUMN id SET DEFAULT nextval('automation_hub.ticket_id_seq'::regclass);

ALTER TABLE ONLY automation_hub.virtual_machine ALTER COLUMN id SET DEFAULT nextval('automation_hub.virtual_machine_id_seq'::regclass);

ALTER TABLE ONLY automation_hub.vm_cost ALTER COLUMN id SET DEFAULT nextval('automation_hub.vm_cost_id_seq'::regclass);
