-- Generated from dump-pg16-automation_hub-202609041902-plain (1).sql
-- Run these files in order in the Cloud SQL query editor.

ALTER TABLE ONLY automation_hub.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);

ALTER TABLE ONLY automation_hub.ams_1l_cost
    ADD CONSTRAINT ams_1l_cost_ams_year_id_key UNIQUE (ams_year_id);

ALTER TABLE ONLY automation_hub.ams_1l_cost
    ADD CONSTRAINT ams_1l_cost_pkey PRIMARY KEY (id);

ALTER TABLE ONLY automation_hub.ams_2l_cost
    ADD CONSTRAINT ams_2l_cost_pkey PRIMARY KEY (id);

ALTER TABLE ONLY automation_hub.ams_rfc_cost
    ADD CONSTRAINT ams_rfc_cost_pkey PRIMARY KEY (id);

ALTER TABLE ONLY automation_hub.ams_year
    ADD CONSTRAINT ams_year_code_key UNIQUE (code);

ALTER TABLE ONLY automation_hub.ams_year
    ADD CONSTRAINT ams_year_ordinal_key UNIQUE (ordinal);

ALTER TABLE ONLY automation_hub.ams_year
    ADD CONSTRAINT ams_year_pkey PRIMARY KEY (id);

ALTER TABLE ONLY automation_hub.app_user
    ADD CONSTRAINT app_user_pkey PRIMARY KEY (id);

ALTER TABLE ONLY automation_hub.application
    ADD CONSTRAINT application_name_key UNIQUE (name);

ALTER TABLE ONLY automation_hub.application
    ADD CONSTRAINT application_pkey PRIMARY KEY (id);

ALTER TABLE ONLY automation_hub.apqc_category
    ADD CONSTRAINT apqc_category_hierarchy_id_key UNIQUE (hierarchy_id);

ALTER TABLE ONLY automation_hub.apqc_category
    ADD CONSTRAINT apqc_category_pcf_id_key UNIQUE (pcf_id);

ALTER TABLE ONLY automation_hub.apqc_category
    ADD CONSTRAINT apqc_category_pkey PRIMARY KEY (id);

ALTER TABLE ONLY automation_hub.apqc_process_group
    ADD CONSTRAINT apqc_process_group_hierarchy_id_key UNIQUE (hierarchy_id);

ALTER TABLE ONLY automation_hub.apqc_process_group
    ADD CONSTRAINT apqc_process_group_pcf_id_key UNIQUE (pcf_id);

ALTER TABLE ONLY automation_hub.apqc_process_group
    ADD CONSTRAINT apqc_process_group_pkey PRIMARY KEY (id);

ALTER TABLE ONLY automation_hub.apqc_process
    ADD CONSTRAINT apqc_process_hierarchy_id_key UNIQUE (hierarchy_id);

ALTER TABLE ONLY automation_hub.apqc_process
    ADD CONSTRAINT apqc_process_pcf_id_key UNIQUE (pcf_id);

ALTER TABLE ONLY automation_hub.apqc_process
    ADD CONSTRAINT apqc_process_pkey PRIMARY KEY (id);

ALTER TABLE ONLY automation_hub.company
    ADD CONSTRAINT company_name_key UNIQUE (name);

ALTER TABLE ONLY automation_hub.company
    ADD CONSTRAINT company_pkey PRIMARY KEY (id);

ALTER TABLE ONLY automation_hub.department
    ADD CONSTRAINT department_name_key UNIQUE (name);

ALTER TABLE ONLY automation_hub.department
    ADD CONSTRAINT department_pkey PRIMARY KEY (id);

ALTER TABLE ONLY automation_hub.idea
    ADD CONSTRAINT idea_pkey PRIMARY KEY (id);

ALTER TABLE ONLY automation_hub.license_cost
    ADD CONSTRAINT license_cost_pkey PRIMARY KEY (id);

ALTER TABLE ONLY automation_hub.priority
    ADD CONSTRAINT priority_pkey PRIMARY KEY (id);

ALTER TABLE ONLY automation_hub.priority
    ADD CONSTRAINT priority_value_key UNIQUE (value);

ALTER TABLE ONLY automation_hub.process_application
    ADD CONSTRAINT process_application_pkey PRIMARY KEY (id);

ALTER TABLE ONLY automation_hub.process
    ADD CONSTRAINT process_canonical_name_key UNIQUE (canonical_name);

ALTER TABLE ONLY automation_hub.process_economics
    ADD CONSTRAINT process_economics_pkey PRIMARY KEY (id);

ALTER TABLE ONLY automation_hub.process_economics
    ADD CONSTRAINT process_economics_process_id_key UNIQUE (process_id);

ALTER TABLE ONLY automation_hub.process
    ADD CONSTRAINT process_pkey PRIMARY KEY (id);

ALTER TABLE ONLY automation_hub.process_schedule
    ADD CONSTRAINT process_schedule_pkey PRIMARY KEY (id);

ALTER TABLE ONLY automation_hub.reference_variable
    ADD CONSTRAINT reference_variable_name_key UNIQUE (name);

ALTER TABLE ONLY automation_hub.reference_variable
    ADD CONSTRAINT reference_variable_pkey PRIMARY KEY (id);

ALTER TABLE ONLY automation_hub.root_cause
    ADD CONSTRAINT root_cause_name_key UNIQUE (name);

ALTER TABLE ONLY automation_hub.root_cause
    ADD CONSTRAINT root_cause_pkey PRIMARY KEY (id);

ALTER TABLE ONLY automation_hub.support_level
    ADD CONSTRAINT support_level_code_key UNIQUE (code);

ALTER TABLE ONLY automation_hub.support_level
    ADD CONSTRAINT support_level_pkey PRIMARY KEY (id);

ALTER TABLE ONLY automation_hub.tco_cost
    ADD CONSTRAINT tco_cost_pkey PRIMARY KEY (id);

ALTER TABLE ONLY automation_hub.ticket
    ADD CONSTRAINT ticket_pkey PRIMARY KEY (id);

ALTER TABLE ONLY automation_hub.ticket
    ADD CONSTRAINT ticket_ticket_id_key UNIQUE (ticket_id);

ALTER TABLE ONLY automation_hub.license_cost
    ADD CONSTRAINT uq_license_cost_year_vm UNIQUE (year, virtual_machine_id);

ALTER TABLE ONLY automation_hub.process_application
    ADD CONSTRAINT uq_process_application UNIQUE (process_id, application_id);

ALTER TABLE ONLY automation_hub.vm_cost
    ADD CONSTRAINT uq_vm_cost_year_vm UNIQUE (year, virtual_machine_id);

ALTER TABLE ONLY automation_hub.virtual_machine
    ADD CONSTRAINT virtual_machine_normalized_id_key UNIQUE (normalized_id);

ALTER TABLE ONLY automation_hub.virtual_machine
    ADD CONSTRAINT virtual_machine_pkey PRIMARY KEY (id);

ALTER TABLE ONLY automation_hub.vm_cost
    ADD CONSTRAINT vm_cost_pkey PRIMARY KEY (id);

CREATE INDEX ix_app_user_email ON automation_hub.app_user USING btree (email);

CREATE UNIQUE INDEX ix_app_user_sub ON automation_hub.app_user USING btree (sub);

CREATE INDEX ix_core_ams_2l_cost_ticket_id ON automation_hub.ams_2l_cost USING btree (ticket_id);

CREATE INDEX ix_core_ams_rfc_cost_process_id ON automation_hub.ams_rfc_cost USING btree (process_id);

CREATE UNIQUE INDEX ix_core_apqc_category_pcf_id ON automation_hub.apqc_category USING btree (pcf_id);

CREATE INDEX ix_core_apqc_process_group_category_id ON automation_hub.apqc_process_group USING btree (category_id);

CREATE UNIQUE INDEX ix_core_apqc_process_group_pcf_id ON automation_hub.apqc_process_group USING btree (pcf_id);

CREATE UNIQUE INDEX ix_core_apqc_process_pcf_id ON automation_hub.apqc_process USING btree (pcf_id);

CREATE INDEX ix_core_apqc_process_process_group_id ON automation_hub.apqc_process USING btree (process_group_id);

CREATE INDEX ix_core_idea_apqc_process_id ON automation_hub.idea USING btree (apqc_process_id);

CREATE INDEX ix_core_process_application_application_id ON automation_hub.process_application USING btree (application_id);

CREATE INDEX ix_core_process_application_process_id ON automation_hub.process_application USING btree (process_id);

CREATE UNIQUE INDEX ix_core_process_normalized_key ON automation_hub.process USING btree (normalized_key);

CREATE INDEX ix_core_process_schedule_process_id ON automation_hub.process_schedule USING btree (process_id);

CREATE INDEX ix_core_tco_cost_cost_date ON automation_hub.tco_cost USING btree (cost_date);

CREATE INDEX ix_core_ticket_company_id ON automation_hub.ticket USING btree (company_id);

CREATE INDEX ix_core_ticket_process_id ON automation_hub.ticket USING btree (process_id);

CREATE INDEX ix_core_ticket_root_cause_id ON automation_hub.ticket USING btree (root_cause_id);
