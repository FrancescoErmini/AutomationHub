-- Generated from dump-pg16-automation_hub-202609041902-plain (1).sql
-- Run these files in order in the Cloud SQL query editor.

ALTER TABLE ONLY automation_hub.ams_1l_cost
    ADD CONSTRAINT ams_1l_cost_ams_year_id_fkey FOREIGN KEY (ams_year_id) REFERENCES automation_hub.ams_year(id);

ALTER TABLE ONLY automation_hub.ams_2l_cost
    ADD CONSTRAINT ams_2l_cost_company_id_fkey FOREIGN KEY (company_id) REFERENCES automation_hub.company(id);

ALTER TABLE ONLY automation_hub.ams_2l_cost
    ADD CONSTRAINT ams_2l_cost_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES automation_hub.ticket(id);

ALTER TABLE ONLY automation_hub.ams_rfc_cost
    ADD CONSTRAINT ams_rfc_cost_process_id_fkey FOREIGN KEY (process_id) REFERENCES automation_hub.process(id);

ALTER TABLE ONLY automation_hub.apqc_process_group
    ADD CONSTRAINT apqc_process_group_category_id_fkey FOREIGN KEY (category_id) REFERENCES automation_hub.apqc_category(id);

ALTER TABLE ONLY automation_hub.apqc_process
    ADD CONSTRAINT apqc_process_process_group_id_fkey FOREIGN KEY (process_group_id) REFERENCES automation_hub.apqc_process_group(id);

ALTER TABLE ONLY automation_hub.ticket
    ADD CONSTRAINT fk_ticket_support_level_id FOREIGN KEY (support_level_id) REFERENCES automation_hub.support_level(id);

ALTER TABLE ONLY automation_hub.idea
    ADD CONSTRAINT idea_apqc_process_id_fkey FOREIGN KEY (apqc_process_id) REFERENCES automation_hub.apqc_process(id);

ALTER TABLE ONLY automation_hub.license_cost
    ADD CONSTRAINT license_cost_virtual_machine_id_fkey FOREIGN KEY (virtual_machine_id) REFERENCES automation_hub.virtual_machine(id);

ALTER TABLE ONLY automation_hub.process
    ADD CONSTRAINT process_ams_year_id_fkey FOREIGN KEY (ams_year_id) REFERENCES automation_hub.ams_year(id);

ALTER TABLE ONLY automation_hub.process_application
    ADD CONSTRAINT process_application_application_id_fkey FOREIGN KEY (application_id) REFERENCES automation_hub.application(id);

ALTER TABLE ONLY automation_hub.process_application
    ADD CONSTRAINT process_application_process_id_fkey FOREIGN KEY (process_id) REFERENCES automation_hub.process(id);

ALTER TABLE ONLY automation_hub.process
    ADD CONSTRAINT process_company_id_fkey FOREIGN KEY (company_id) REFERENCES automation_hub.company(id);

ALTER TABLE ONLY automation_hub.process
    ADD CONSTRAINT process_department_id_fkey FOREIGN KEY (department_id) REFERENCES automation_hub.department(id);

ALTER TABLE ONLY automation_hub.process_economics
    ADD CONSTRAINT process_economics_process_id_fkey FOREIGN KEY (process_id) REFERENCES automation_hub.process(id);

ALTER TABLE ONLY automation_hub.process_schedule
    ADD CONSTRAINT process_schedule_process_id_fkey FOREIGN KEY (process_id) REFERENCES automation_hub.process(id);

ALTER TABLE ONLY automation_hub.process_schedule
    ADD CONSTRAINT process_schedule_virtual_machine_id_fkey FOREIGN KEY (virtual_machine_id) REFERENCES automation_hub.virtual_machine(id);

ALTER TABLE ONLY automation_hub.ticket
    ADD CONSTRAINT ticket_ams_year_id_fkey FOREIGN KEY (ams_year_id) REFERENCES automation_hub.ams_year(id);

ALTER TABLE ONLY automation_hub.ticket
    ADD CONSTRAINT ticket_company_id_fkey FOREIGN KEY (company_id) REFERENCES automation_hub.company(id);

ALTER TABLE ONLY automation_hub.ticket
    ADD CONSTRAINT ticket_priority_id_fkey FOREIGN KEY (priority_id) REFERENCES automation_hub.priority(id);

ALTER TABLE ONLY automation_hub.ticket
    ADD CONSTRAINT ticket_process_id_fkey FOREIGN KEY (process_id) REFERENCES automation_hub.process(id);

ALTER TABLE ONLY automation_hub.ticket
    ADD CONSTRAINT ticket_root_cause_id_fkey FOREIGN KEY (root_cause_id) REFERENCES automation_hub.root_cause(id);

ALTER TABLE ONLY automation_hub.vm_cost
    ADD CONSTRAINT vm_cost_virtual_machine_id_fkey FOREIGN KEY (virtual_machine_id) REFERENCES automation_hub.virtual_machine(id);
