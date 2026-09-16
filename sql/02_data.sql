-- Generated from dump-pg16-automation_hub-202609041902-plain (1).sql
-- Run these files in order in the Cloud SQL query editor.

-- tables: alembic_version, ams_year, company, department, priority, root_cause, support_level, application, apqc_category, reference_variable, virtual_machine, app_user, tco_cost, apqc_process_group

-- alembic_version (1 rows)
INSERT INTO automation_hub.alembic_version (version_num) VALUES
('20260904_0022');

-- ams_year (5 rows)
INSERT INTO automation_hub.ams_year (id, code, ordinal, year) VALUES
('7', '1st', '1', '2024'),
('8', '2nd', '2', '2025'),
('9', '3rd', '3', '2026'),
('10', '4th', '4', '2027'),
('11', '0th-2020', '0', '2020');

-- company (2 rows)
INSERT INTO automation_hub.company (id, name, created_at) VALUES
('5', 'Menarini', '2026-08-24 12:52:57.444284+00'),
('6', 'Codifi', '2026-08-24 12:52:57.444284+00');

-- department (19 rows)
INSERT INTO automation_hub.department (id, name, created_at) VALUES
('39', 'Customer Service Pharma', '2026-08-24 12:52:57.444284+00'),
('40', 'Logistic & Distribution', '2026-08-24 12:52:57.444284+00'),
('41', 'International Distribution', '2026-08-24 12:52:57.444284+00'),
('42', 'Quality Management', '2026-08-24 12:52:57.444284+00'),
('43', 'ICT', '2026-08-24 12:52:57.444284+00'),
('44', 'FFE', '2026-08-24 12:52:57.444284+00'),
('45', 'Supply Chain & Planning', '2026-08-24 12:52:57.444284+00'),
('46', 'Sales & Distribution', '2026-08-24 12:52:57.444284+00'),
('47', 'Procurement', '2026-08-24 12:52:57.444284+00'),
('48', 'Customer Service Diagnostics', '2026-08-24 12:52:57.444284+00'),
('49', 'Tender Management', '2026-08-24 12:52:57.444284+00'),
('50', 'Sales Administration', '2026-08-24 12:52:57.444284+00'),
('51', 'Finance', '2026-08-24 12:52:57.444284+00'),
('52', 'Manufacturing', '2026-08-24 12:52:57.444284+00'),
('53', 'Data Governance', '2026-08-24 12:52:57.444284+00'),
('54', 'Global Regulatory Affairs', '2026-08-24 12:52:57.444284+00'),
('55', 'Opportunity to Launch', '2026-08-24 12:52:57.444284+00'),
('56', 'PM & Contact Center', '2026-08-24 12:52:57.444284+00'),
('57', 'Global Marketing & Sales', '2026-08-24 12:52:57.444284+00');

-- priority (1 rows)
INSERT INTO automation_hub.priority (id, value, created_at) VALUES
('3', '3', '2026-08-24 12:52:57.444284+00');

-- root_cause (12 rows)
INSERT INTO automation_hub.root_cause (id, name, created_at) VALUES
('25', 'Richiesta evolutiva / requisito non gestito', '2026-08-24 12:52:57.444284+00'),
('26', 'Evasione SR', '2026-08-24 12:52:57.444284+00'),
('27', 'Problema SW esterno RPA', '2026-08-24 12:52:57.444284+00'),
('28', 'Data Quality / Data Lineage', '2026-08-24 12:52:57.444284+00'),
('29', 'Problema Funzionale RPA', '2026-08-24 12:52:57.444284+00'),
('30', 'utilizzo improprio utente', '2026-08-24 12:52:57.444284+00'),
('31', 'Schedulazione RPA (problema non funzionale)', '2026-08-24 12:52:57.444284+00'),
('32', 'incidente raro e poco ripetibile', '2026-08-24 12:52:57.444284+00'),
('33', 'indisponibilità Infrastruttura', '2026-08-24 12:52:57.444284+00'),
('34', 'Errata manutenzione / intervento umano', '2026-08-24 12:52:57.444284+00'),
('35', 'Duplicazione da non considerare', '2026-08-24 12:52:57.444284+00'),
('36', 'utilizzo improprio / errore utente', '2026-08-24 12:52:57.444284+00');

-- support_level (2 rows)
INSERT INTO automation_hub.support_level (id, code, description) VALUES
('5', '1L', 'First-line AMS support'),
('6', '2L', 'Second-line AMS support');

-- application (20 rows)
INSERT INTO automation_hub.application (id, name, created_at) VALUES
('21', 'SAP', '2026-08-24 12:52:57.444284+00'),
('22', 'EudraVigilance', '2026-08-24 12:52:57.444284+00'),
('23', 'Multiple Applications', '2026-08-24 12:52:57.444284+00'),
('24', 'Oracle DB', '2026-08-24 12:52:57.444284+00'),
('25', 'Dataservice', '2026-08-24 12:52:57.444284+00'),
('26', 'SAP APO', '2026-08-24 12:52:57.444284+00'),
('27', 'P2P API/Database', '2026-08-24 12:52:57.444284+00'),
('28', 'Supervisor website', '2026-08-24 12:52:57.444284+00'),
('29', 'Gmail', '2026-08-24 12:52:57.444284+00'),
('30', 'Excel', '2026-08-24 12:52:57.444284+00'),
('31', 'AS400', '2026-08-24 12:52:57.444284+00'),
('32', 'Archiflow', '2026-08-24 12:52:57.444284+00'),
('33', 'P2P system [Google Chrome]', '2026-08-24 12:52:57.444284+00'),
('34', 'Adobe Acrobat', '2026-08-24 12:52:57.444284+00'),
('35', 'Oracle', '2026-08-24 12:52:57.444284+00'),
('36', 'Veeva', '2026-08-24 12:52:57.444284+00'),
('37', 'Webapp site', '2026-08-24 12:52:57.444284+00'),
('38', 'Salesforce', '2026-08-24 12:52:57.444284+00'),
('39', 'Web interface', '2026-08-24 12:52:57.444284+00'),
('40', 'MIS portal (Google Chrome)', '2026-08-24 12:52:57.444284+00');

-- apqc_category (13 rows)
INSERT INTO automation_hub.apqc_category (id, pcf_id, hierarchy_id, name, description) VALUES
('1', '10002', '1.0', 'Develop Vision and Strategy', 'Establishing a direction and vision for an organization. This involves defining the business concept and long-term vision, as well as developing the business strategy and managing strategic initiatives. Processes in this category focus on creating a vision, a mission, and strategic objectives, and culminate in creating measures to ensure that the organization is moving in the desired direction.'),
('2', '10003', '2.0', 'Develop and Manage Products and Services', 'Detailing practices and procedures related to the concept of developing and managing products and services. These are reflected in the process groups Govern and manage product/service development program [19696], Generate and define new product/service ideas [19698], and Develop products and services [10062].'),
('3', '10004', '3.0', 'Market and Sell Products and Services', 'Outlining process groups related to understanding markets, customers, and capabilities; developing marketing strategies; executing marketing plans; developing sales strategies; developing and managing marketing plans; and managing sales partners and alliances.'),
('4', '20022', '4.0', 'Deliver Physical Products', 'Performing supply chain activities include planning supply chain, procuring materials and services, and managing logistics.'),
('5', '20025', '5.0', 'Deliver Services', 'Offering services to customers. This is the act of providing service delivery as a core business practice and covers identifying strategies for performing service delivery, managing resources, and delivering services to the customer.'),
('6', '20592', '6.0', 'Manage Customer Service', NULL),
('7', '10007', '7.0', 'Develop and Manage Human Capital', 'Delivering processes traditionally defined as "human resources". Process groups include those related to developing and maintaining workforce strategy, recruiting employees, developing and counseling employees, managing employee relations, rewarding and retaining employees, redeploying and retiring employees, managing employee information, and managing employee communications.'),
('8', '20607', '8.0', 'Manage Information Technology (IT)', 'Managing process groups relevant to the business of information technology within an organization. The process groups include "Develop and manage IT customer relationships", "Develop and manage IT business strategy", " Develop and manage IT resilience and risk", " Manage information", " Develop and manage services/solutions", "Deploy services/solutions", and " Create and manage support services/solutions".'),
('9', '17058', '9.0', 'Manage Financial Resources', 'Overseeing key back-office processes for organizations. This category includes process groups related to planning and management accounting, revenue accounting, general accounting and reporting, fixed-asset project accounting, payroll, accounts payable and expense reimbursements, treasury operations, internal controls, tax management, international funds/consolidation, and global trade services.'),
('10', '19207', '10.0', 'Acquire, Construct, and Manage Assets', 'Relating to the design, construction, acquisition, and management of both productive and non-productive assets.'),
('11', '16437', '11.0', 'Manage Enterprise Risk, Compliance, Remediation, and Resiliency', 'Ensuring that an organization effectively manages its risk. Process groups are aligned with traditional risk management activities.'),
('12', '10012', '12.0', 'Manage External Relationships', 'Fostering external relationships with stakeholders of the entity, including investors, government and industry, the board of directors, and the general public. This is not related to customer management.'),
('13', '10013', '13.0', 'Develop and Manage Business Capabilities', 'Performing activities by an organization that are fundamental to the successful operation of the organization, even across functions in a business. Capabilities defined in the PCF include business process management; portfolio, program, and project management; quality management; change management; benchmarking; environmental health and safety management; and knowledge management.');

-- reference_variable (1 rows)
INSERT INTO automation_hub.reference_variable (id, name, value, note) VALUES
('4', 'cost_per_hour_FTE', '26.6000', '"Costo orario FTE impostato a 26,60 €/ora. Questo valore rappresenta il Costo Aziendale Totale (Fully Loaded Cost) di una risorsa con inquadramento CCNL Chimico-Farmaceutico Livello C2. Il calcolo presuppone un monte ore annuo produttivo di 1.720 ore e un moltiplicatore per contributi (INPS, INAIL) e TFR pari a 1,38. L''equivalente è una RAL esatta di 33.153,62 € (circa 2.368 € lordi per 14 mensilità)');

-- virtual_machine (14 rows)
INSERT INTO automation_hub.virtual_machine (id, normalized_id, created_at) VALUES
('18', 'RPAP11', '2026-08-24 12:52:57.444284+00'),
('19', 'RPAP40', '2026-08-24 12:52:57.444284+00'),
('20', 'RPAP21', '2026-08-24 12:52:57.444284+00'),
('21', 'RPAP31', '2026-08-24 12:52:57.444284+00'),
('22', 'RPAP30', '2026-08-24 12:52:57.444284+00'),
('23', 'RPAP22', '2026-08-24 12:52:57.444284+00'),
('24', 'RPAP25', '2026-08-24 12:52:57.444284+00'),
('25', 'RPAD01', '2026-08-24 12:00:00+00'),
('26', 'RPAD11', '2026-08-24 12:00:00+00'),
('27', 'RPAD21', '2026-08-24 12:00:00+00'),
('28', 'RPAP02', '2026-08-24 14:03:33.271229+00'),
('29', 'RPAD02', '2026-08-24 14:03:40.767483+00'),
('30', 'RPAD20', '2026-08-24 14:04:02.281919+00'),
('31', 'RPAP20', '2026-08-24 14:04:10.75261+00');

-- app_user (1 rows)
INSERT INTO automation_hub.app_user (id, sub, email, preferred_username, name, given_name, family_name, role, created_at, updated_at) VALUES
('1', '303431dd-2a3c-4b8a-906f-c33446c99e63', 'fermini@menarini.it', 'erminif', 'Francesco Ermini', 'Francesco', 'Ermini', 'editor', '2026-08-29 16:39:02.577087+00', '2026-08-31 08:46:53.459397+00');

-- tco_cost (82 rows)
INSERT INTO automation_hub.tco_cost (id, cost_date, cost_eur, cost_type, subtype, description, created_at) VALUES
('167', '2020-01-01', '33600.00', 'OPEX', 'INFRA', 'GCP INFRA PROD + TEST FOR VMS:', '2026-08-25 15:33:55.700627+00'),
('168', '2021-01-01', '33600.00', 'OPEX', 'INFRA', 'GCP INFRA PROD + TEST FOR VMS: 5', '2026-08-25 15:33:55.700627+00'),
('169', '2022-01-01', '53760.00', 'OPEX', 'INFRA', 'GCP INFRA PROD + TEST FOR VMS: 8', '2026-08-25 15:33:55.700627+00'),
('170', '2023-01-01', '67200.00', 'OPEX', 'INFRA', 'GCP INFRA PROD + TEST FOR VMS: 10', '2026-08-25 15:33:55.700627+00'),
('171', '2024-01-01', '73920.00', 'OPEX', 'INFRA', 'GCP INFRA PROD + TEST FOR VMS: 11', '2026-08-25 15:33:55.700627+00'),
('172', '2025-01-01', '80640.00', 'OPEX', 'INFRA', 'GCP INFRA PROD + TEST FOR VMS: 12', '2026-08-25 15:33:55.700627+00'),
('173', '2026-01-01', '80640.00', 'OPEX', 'INFRA', 'GCP INFRA PROD + TEST FOR VMS: 12', '2026-08-25 15:33:55.700627+00'),
('174', '2027-01-01', '80640.00', 'OPEX', 'INFRA', 'GCP INFRA PROD + TEST FOR VMS: 12', '2026-08-25 15:33:55.700627+00'),
('175', '2020-01-01', '19500.00', 'CAPEX', 'DEVELOPMENT', 'RPA: Pharmacovigillance', '2026-08-25 15:33:55.700627+00'),
('176', '2020-01-01', '24200.00', 'CAPEX', 'DEVELOPMENT', 'RPA: CODIFI - Wave 1', '2026-08-25 15:33:55.700627+00'),
('177', '2020-01-01', '2800.00', 'CAPEX', 'DEVELOPMENT', 'RPA: Pharmacovigillance', '2026-08-25 15:33:55.700627+00'),
('178', '2020-01-01', '30000.00', 'CAPEX', 'DEVELOPMENT', 'RPA: Application Monitoring', '2026-08-25 15:33:55.700627+00'),
('179', '2020-01-01', '33250.00', 'CAPEX', 'DEVELOPMENT', 'RPA: Double Doctor', '2026-08-25 15:33:55.700627+00'),
('180', '2020-01-01', '31350.00', 'CAPEX', 'DEVELOPMENT', 'RPA: Mass Copy', '2026-08-25 15:33:55.700627+00'),
('181', '2021-01-01', '21327.00', 'CAPEX', 'DEVELOPMENT', 'RPA: APO Permission e Amendment Reminder', '2026-08-25 15:33:55.700627+00'),
('182', '2021-01-01', '47215.00', 'CAPEX', 'DEVELOPMENT', 'RPA: Codifi Wave 2', '2026-08-25 15:33:55.700627+00'),
('183', '2021-01-01', '9535.00', 'OPEX', 'CR', 'RPA: CR - Pharmacovigillanza', '2026-08-25 15:33:55.700627+00'),
('184', '2021-01-01', '32000.00', 'CAPEX', 'DEVELOPMENT', 'RPA: DDM 2.0 POC', '2026-08-25 15:33:55.700627+00'),
('185', '2021-01-01', '8460.00', 'OPEX', 'CR', 'RPA: CR - adeguamenti Grafana', '2026-08-25 15:33:55.700627+00'),
('186', '2021-01-01', '55975.00', 'CAPEX', 'DEVELOPMENT', 'RPA: ODP + MOC + Periodic checks + CR', '2026-08-25 15:33:55.700627+00'),
('187', '2021-01-01', '40000.00', 'CAPEX', 'DEVELOPMENT', 'RPA: Serialization EU - EVMO', '2026-08-25 15:33:55.700627+00'),
('188', '2022-02-08', '21648.00', 'OPEX', 'LICENSES', 'RPA: CODIFI - Rinnovo licenze Blueprism', '2026-08-25 15:33:55.700627+00'),
('189', '2022-02-11', '21648.00', 'OPEX', 'LICENSES', 'RPA: Rinnovo licenze RPA Blueprism', '2026-08-25 15:33:55.700627+00'),
('190', '2022-02-14', '21648.00', 'OPEX', 'LICENSES', 'RPA: Rinnovo licenze RPA Blueprism', '2026-08-25 15:33:55.700627+00'),
('191', '2022-02-18', '17438.00', 'OPEX', 'LICENSES', 'RPA: Rinnovo licenze RPA Blueprism', '2026-08-25 15:33:55.700627+00'),
('192', '2022-02-18', '19242.00', 'OPEX', 'LICENSES', 'RPA: Rinnovo licenze RPA Blueprism', '2026-08-25 15:33:55.700627+00'),
('193', '2022-03-23', '4500.00', 'OPEX', 'CR', 'RPA: CR - ottimizzazione processi Supply Chain', '2026-08-25 15:33:55.700627+00'),
('194', '2022-03-28', '19950.00', 'OPEX', 'LICENSES', 'RPA: processo  approvativo fatture', '2026-08-25 15:33:55.700627+00'),
('195', '2022-07-05', '69872.00', 'OPEX', 'LICENSES', 'RPA: CODIFI  - Processes 2022', '2026-08-25 15:33:55.700627+00'),
('196', '2022-10-25', '25000.00', 'OPEX', 'AMS', 'RPA: Rinnovo AMS Blueprism', '2026-08-25 15:33:55.700627+00'),
('197', '2022-11-04', '13395.00', 'CAPEX', 'DEVELOPMENT', 'RPA: automatizzazione chiusura posizioni ordini MPR multiriga', '2026-08-25 15:33:55.700627+00'),
('198', '2022-11-11', '18600.00', 'OPEX', 'CR', 'RPA: CR - ottimizzazione processi Supply Chain', '2026-08-25 15:33:55.700627+00'),
('199', '2022-12-13', '103350.00', 'CAPEX', NULL, 'RPA: DDM 2.0  1  e 2 Wave + Migliorie processo Mass Copy', '2026-08-25 15:33:55.700627+00'),
('200', '2023-01-09', '11637.00', 'CAPEX', NULL, 'Sviluppi per evoluzione Web/Mobile App', '2026-08-25 15:33:55.700627+00'),
('201', '2023-02-27', '30875.00', 'CAPEX', NULL, 'RPA: Implementazione GRA', '2026-08-25 15:33:55.700627+00'),
('202', '2023-03-08', '11000.00', 'OPEX', 'AMS', 'RPA: Tickets Maintenance Blue Prism CORE', '2026-08-25 15:33:55.700627+00'),
('203', '2023-04-14', '75000.00', 'CAPEX', NULL, 'CODIFI: RPA  - Processes 2023', '2026-08-25 15:33:55.700627+00'),
('204', '2023-04-26', '43184.00', 'CAPEX', NULL, 'RPA: activities for P2P automation', '2026-08-25 15:33:55.700627+00'),
('205', '2023-06-08', '8278.00', 'OPEX', 'LICENSES', 'RPA: Licences for a P2P dedicated server', '2026-08-25 15:33:55.700627+00'),
('206', '2023-06-27', '18715.00', 'CAPEX', NULL, 'RPA: editing codes', '2026-08-25 15:33:55.700627+00'),
('207', '2023-06-27', '21000.00', 'CAPEX', NULL, 'RPA: Tesoreria', '2026-08-25 15:33:55.700627+00'),
('208', '2023-07-24', '17195.00', 'CAPEX', NULL, 'RPA: Eraldo 2.0', '2026-08-25 15:33:55.700627+00'),
('209', '2023-07-24', '36000.00', 'OPEX', 'AMS', 'RPA. AMS Blue Prism Service - Basket di 70 ticket', '2026-08-25 15:33:55.700627+00'),
('210', '2023-09-26', '32062.00', 'CAPEX', NULL, 'RPA: Implementation of analysis of packaging machine protocols process', '2026-08-25 15:33:55.700627+00'),
('211', '2023-11-08', '39000.00', 'OPEX', 'CR', 'RPA: Support and maintenance of Blue Prism Platform', '2026-08-25 15:33:55.700627+00'),
('212', '2023-12-14', '24650.00', 'OPEX', 'CR', 'RPA: fixes and CR Support for fixes and small change requests in Blue Prism Platform', '2026-08-25 15:33:55.700627+00'),
('213', '2023-12-18', '4875.00', 'OPEX', 'CR', 'RPA: CODIFI - Evolutive', '2026-08-25 15:33:55.700627+00'),
('214', '2024-01-03', '2800.00', 'CAPEX', NULL, 'Progetto Revisione modello di controllo - spese di Trasferta', '2026-08-25 15:33:55.700627+00'),
('215', '2024-01-08', '14345.00', 'CAPEX', NULL, 'RPA: CODIFI - Fine Foods process implementation', '2026-08-25 15:33:55.700627+00'),
('216', '2024-01-11', '25000.00', 'OPEX', 'AMS', 'RPA: CODIFI - Maintenance', '2026-08-25 15:33:55.700627+00');

INSERT INTO automation_hub.tco_cost (id, cost_date, cost_eur, cost_type, subtype, description, created_at) VALUES
('217', '2024-01-26', '23602.00', 'OPEX', 'LICENSES', 'RPA: BluePrism license purchase', '2026-08-25 15:33:55.700627+00'),
('218', '2024-02-09', '2600.00', 'OPEX', 'CR', 'RPA: CR Serialization', '2026-08-25 15:33:55.700627+00'),
('219', '2024-02-13', '1300.00', 'OPEX', 'CR', 'RPA: Field Monitoring / CR Gandalf 3', '2026-08-25 15:33:55.700627+00'),
('220', '2024-03-14', '56000.00', 'OPEX', 'AMS', 'RPA: 2023 SMS/AMS for RPA Infrastructure + Basket of 25 tickets', '2026-08-25 15:33:55.700627+00'),
('221', '2024-03-26', '650.00', 'CAPEX', NULL, 'RPA: Editing Codes - CR1 2024', '2026-08-25 15:33:55.700627+00'),
('222', '2024-04-23', '10260.00', 'CAPEX', 'DEVELOPMENT', 'RPA: LMSA Uploading Invoices', '2026-08-25 15:33:55.700627+00'),
('223', '2024-05-21', '1300.00', 'CAPEX', 'DEVELOPMENT', 'RPA. Unlocking P2P invoices', '2026-08-25 15:33:55.700627+00'),
('224', '2024-05-22', '60450.00', 'CAPEX', 'DEVELOPMENT', 'RPA: processes 2024', '2026-08-25 15:33:55.700627+00'),
('225', '2024-05-22', '1300.00', 'CAPEX', 'DEVELOPMENT', 'RPA: Account creation/deactivation in P2P', '2026-08-25 15:33:55.700627+00'),
('226', '2024-06-11', '26144.00', 'OPEX', 'LICENSES', 'BluePrism License 2025,2026, 2027 PTP', '2026-08-25 15:33:55.700627+00'),
('227', '2024-06-22', '3600.00', 'OPEX', 'CR', 'RPA: CR Replenishment of stock quantities', '2026-08-25 15:33:55.700627+00'),
('228', '2024-08-21', '24605.00', 'CAPEX', 'DEVELOPMENT', 'RPA: Claims Management', '2026-08-25 15:33:55.700627+00'),
('229', '2024-11-25', '47072.00', 'CAPEX', 'DEVELOPMENT', 'RPA: vendor Invoices distribution management', '2026-08-25 15:33:55.700627+00'),
('230', '2024-11-25', '36385.00', 'CAPEX', 'DEVELOPMENT', 'RPA: VAT Reporting', '2026-08-25 15:33:55.700627+00'),
('231', '2024-11-29', '43350.00', 'OPEX', 'AMS', 'RPA: Standard basket of 50 tickets', '2026-08-25 15:33:55.700627+00'),
('232', '2024-12-17', '5200.00', 'OPEX', 'CR', 'RPA: CR Pharmacovigilance', '2026-08-25 15:33:55.700627+00'),
('233', '2024-12-18', '27693.00', 'CAPEX', 'DEVELOPMENT', 'RPA: EDMA  Diagnostic report', '2026-08-25 15:33:55.700627+00'),
('234', '2025-01-10', '9750.00', 'OPEX', 'AMS', 'RPA: Basket  of 15 Support day', '2026-08-25 15:33:55.700627+00'),
('235', '2025-02-21', '12450.00', 'OPEX', 'CR', 'RPA: CR Supply Chain MOC', '2026-08-25 15:33:55.700627+00'),
('236', '2025-03-27', '29772.00', 'OPEX', 'LICENSES', 'BluePrism License 2025', '2026-08-25 15:33:55.700627+00'),
('237', '2025-04-01', '29772.00', 'OPEX', 'LICENSES', 'RPA: BluePrism license renewal - year 2025,2026,2027', '2026-08-25 15:33:55.700627+00'),
('238', '2025-06-30', '55859.00', 'CAPEX', 'DEVELOPMENT', 'RPA: CODIFI - Processes 2025', '2026-08-25 15:33:55.700627+00'),
('239', '2025-07-15', '27217.00', 'CAPEX', 'DEVELOPMENT', 'RPA: Veeva Data Entry Automation', '2026-08-25 15:33:55.700627+00'),
('240', '2025-07-22', '3300.00', 'OPEX', 'CR', 'RPA: Serialization EU - EVMO', '2026-08-25 15:33:55.700627+00'),
('241', '2025-07-25', '9357.00', 'CAPEX', 'DEVELOPMENT', 'RPA:  Serialization   process  - alerts coming from EMVO', '2026-08-25 15:33:55.700627+00'),
('242', '2025-07-31', '14300.00', 'OPEX', 'CR', 'RPA: CODIFI - CR Supervisor Refactoring', '2026-08-25 15:33:55.700627+00'),
('243', '2025-12-09', '9750.00', 'OPEX', 'CR', 'RPA: updated for the new P2P cloud platform', '2026-08-25 15:33:55.700627+00'),
('244', '2026-01-08', '6500.00', 'OPEX', 'AMS', 'RPA: CODIFI - Basket 10 days', '2026-08-25 15:33:55.700627+00'),
('245', '2025-04-01', '60000.00', 'OPEX', 'AMS', 'AMS 2025-2026', '2026-08-25 15:33:55.700627+00'),
('246', '2026-01-08', '11000.00', 'OPEX', 'AMS', 'CODIFI Tickets', '2026-08-25 15:33:55.700627+00'),
('247', '2025-11-27', '16762.00', 'CAPEX', 'DEVELOPMENT', 'RPA: CODIFI Steamline', '2026-08-25 15:33:55.700627+00'),
('248', '2026-04-01', '72800.00', 'OPEX', 'AMS', 'AMS 2025-2026', '2026-08-25 15:33:55.700627+00');

-- apqc_process_group (76 rows)
INSERT INTO automation_hub.apqc_process_group (id, pcf_id, hierarchy_id, name, description, category_id) VALUES
('1', '17040', '1.1', 'Define the business concept and long-term vision', 'Creating a conceptual framework of the organization''s business activity and strategic vision with long-term applicability. Scout the organization''s internal capabilities, as well as the customer''s needs and desires, to identify a fit that can be used to advance a conceptual structure of the organization''s business activity. Conduct analysis in light of relevant externalities and large-scale shifts in the market landscape.', '1'),
('2', '10015', '1.2', 'Develop business strategy', 'Developing an organization''s mission statement, strategy, and business design. Create a concise statement that clearly articulates the mission of the organization, outlining practicable targets to Establish a strategic vision [10020]. Delineate strategic options by matching these alternatives with the organization''s internal capabilities. Create an organizational design, and identify goals by developing strategies at the functional and process levels.', '1'),
('3', '10016', '1.3', 'Execute and measure strategic initiatives', 'Managing strategic initiatives, from development through selection, execution, and evaluation. Conduct and oversee strategic projects supporting long-term objectives. Administer programs of strategic significance by developing such initiatives, select the most appropriate projects, and formulate measures to assess their impact.', '1'),
('4', '20944', '1.4', 'Develop and maintain business models', 'Establishing how an organization creates, delivers and captures value or makes profit. Identify the products or services that a business will sell, its target market, anticipated expenses, and other core aspects of its modus operandi. Revise the plan as required to reflect changing circumstances.', '1'),
('5', '19696', '2.1', 'Govern and manage product/service development program', 'Supervising the complete product/service program from innovation until its commercial success. Meeting the customer demand and expectations. Conduct further development and innovation pertaining to business goals.', '2'),
('6', '12752', '2.2', 'Discover Products', 'Managing and executing of research into and licensing of new products.', '2'),
('7', '19698', '2.3', 'Generate and define new product/service ideas', 'Identifying and describing new product or service thoughts based on organizational objectives/targets.', '2'),
('8', '10062', '2.4', 'Develop products and services', 'Developing new products/services from scratch, including all activities associated with the design, prototyping, evaluation, and market testing of these planned offerings.', '2'),
('9', '18623', '3.1', 'Understand markets, customers, and capabilities', NULL, '3'),
('10', '10102', '3.2', 'Develop marketing strategy', 'Charting a strategic course for marketing products/services. This will include defining the value proposition, creating a mechanism for pricing, and determining the right mix of marketing channels. Create a specific positioning and branding for the organization''s offerings. Enlist marketing head to lead, with inputs from the business development and sales functions.', '3'),
('11', '20008', '3.3', 'Develop and manage marketing plans', 'Creating specific plans to market offerings to customers. This process group includes processes for making budgets, identifying and developing media, pricing products and services, managing packaging, managing marketing content and promotional activities, tracking and responding to customer insight and monitoring measures established within "develop marketing strategy". Additionally, in this process group, organizations take action on plans made in earlier processes. Here, marketing and customers are managed and measured along with any supporting materials.', '3'),
('12', '10103', '3.4', 'Develop sales strategy', 'Developing concrete plans for guiding and providing support to the sales function. Chart a road map for the sales function, including an analysis of historical sales data to create forecasts for anticipated sales, forming sales targets, forging partnerships with other economic agents to boost sales, devising a budget for this function, and determining metrics to measure customer management activities as well as progress in achieving sales targets.', '3'),
('13', '10105', '3.5', 'Develop and manage sales plans', 'Selling products/services. Set appropriate customer expectations. Work with customers using the same schedule that product/service development, production, and customer service functions follow. Manage sales personnel and sales partnerships/alliances.', '3'),
('14', '10215', '4.1', 'Plan for and align supply chain resources', 'Creating strategies for production and materials. Handle the demand for the products of the organization. Develop plans for handling materials. Develop and administer the schedule for master production. Plan for distribution requirements and its constraints by reviewing and assessing distribution policies and performance and by establishing quality standards and procedures. ', '4'),
('15', '10216', '4.2', 'Procure materials and services', 'Creating a plan for procuring materials and services. Develop strategies for sourcing materials and services. Choose the most appropriate suppliers, and develop contracts with them. Order the materials and services as per the requirements. Manage relationships with suppliers.', '4'),
('16', '10217', '4.3', 'Produce/Assemble/Test product', 'Processing and delivering the finished goods manufactured by the organization. Schedule the production of products. Execute the product production activities. Perform tests to oversee and ensure quality of production. Maintain records of the production process. Track lots.', '4'),
('17', '12826', '4.4', 'Manage Quality Assurance/Quality Control', 'Assuring the quality of the products produced. Develop a quality management system that to include an appropriate organizational structure, procedure, processes and resources, and systematic actions  to meet requirements for quality.  Develop quality standards and sampling procedures.  Obtain a representative portion of a pharmaceutical product, based on an appropriate statistical procedure, for a defined purpose such as the acceptance of consignments or batch release.  Stability and validating tests are conducted and the test results are maintained.  Provide evidence of how the quality of an API (Active pharmaceutical ingredient) or FPP (finished pharmaceutical products) varies with time under the influence of a variety of environmental factors.  Study product-related factors that influence its quality.  Establish a re-test period for the API or a shelf-life for the FPP and recommend storage conditions. Maintain batch records and manage lot traceability to track items created during the Schedule production [10303] and Produce product [10304].', '4'),
('18', '17698', '4.5', 'Develop Sample Program and Requirements', NULL, '4'),
('19', '10219', '4.6', 'Manage logistics and warehousing', 'Administering and overseeing all activities related to logistics and warehousing. Outline and establish a strategy for the logistics function. Plan and administer the flow of inbound materials. Administer the operational activities of warehousing and outbound transportation. Manage reverse logistics including returns and exchanges.', '4'),
('20', '20026', '5.1', 'Establish service delivery governance and strategies', 'Creating rules and regulations for service delivery to the customer. Establish a system to manage performance, delivery, and direction of service delivery. Engage with the customer for satisfaction feedback. Define goals, policies, processes, and workplace layout and infrastructure as a part of the service delivery strategy.', '5'),
('21', '20040', '5.2', 'Manage service delivery resources', 'Understanding the demands on resources and creating a plan to enable the delivery of services via those resources.', '5'),
('22', '20058', '5.3', 'Deliver service to customer', 'Rendering service to the customer by initiating, executing, and completing tasks associated with service delivery.', '5'),
('23', '10378', '6.1', 'Develop customer care/customer service strategy', 'Defining a plan that removes customer obstacles by gathering operational insight and competitive insight, as well as improving soft skills and forward resolution for employees. Develop customer segmentation. Define rules and regulations for customer service. Establish service levels for customers.', '6'),
('24', '10379', '6.2', 'Plan and manage customer service contacts', 'Planning and administering work force operations for customer service provision by taking care of customer services requests/inquiries, as well as the complaints.', '6'),
('25', '12658', '6.3', 'Service products after sales', 'Assigning post-sales policies and paying claims on purchased products.  This is a process that is an administrative function focused on creating rules (claim codes). This group ensures that claims are valid and are processed quickly.  As well as to quickly determine responsibility for claim settlement. ', '6'),
('26', '20110', '6.4', 'Manage product recalls and regulatory audits', 'Removing defective products from the distribution chain. Participate in audits from watchdog agencies.', '6'),
('27', '20595', '6.5', 'Evaluate customer service operations and customer satisfaction', 'Calculating and assessing the operational activities of the customer service function. Evaluation is achieved through the customer requests/inquiries handling process, the customer complaint handling process, and product and services quality. Examine activities to ensure high levels of customer service.', '6'),
('28', '17043', '7.1', 'Develop and manage human resources (HR) planning, policies, and strategies', 'Creating strategies for the HR function. Create and implement strategies for managing the work force. Supervise and enhance the strategies, plans, and policies supporting the HR function. Developing models for managing competency levels of the HR of the organization.', '7'),
('29', '10410', '7.2', 'Recruit, source, and select employees', 'Determining and handling employee requirements. Recruit or source the candidates as per the requirements. Screen and select the most appropriate candidates. Take care of the newly hired and re-hired employees. Maintain records of information for all applicants. ', '7'),
('30', '20599', '7.3', 'Manage employee on-boarding, development, and training', 'Assisting employees in developing their capabilities, and providing them counseling services. Handle the orientation and deployment of the employees. Administer the performance of employees. Administer the development and enhancement of the employees. Provide training and development programs for employees.', '7'),
('31', '17052', '7.4', 'Manage employee relations', 'Assisting general management in developing, maintaining, and improving employee relationships. This is accomplished through communication, performance management, processing grievances, and/or dispute. Interpret and convey organizational policies.', '7'),
('32', '10412', '7.5', 'Reward and retain employees', 'Creating frameworks for rewarding and recognizing employees with the objective of retaining them. Create and manage programs for provision of rewards, recognition, and motivation. Manage and administer the benefits for employees. Help assist and retain employees. Administer payroll to employees.', '7'),
('33', '10413', '7.6', 'Redeploy and retire employees', 'Managing the reassignment and retirement of employees. Manage the process of employee promotion and demotion. Administer separation, retirement, and leaves of absence. Outplace employees. Deploy personnel. Relocate employees in order to manage assignments.', '7'),
('34', '17056', '7.7', 'Manage employee information and analytics', 'Managing the employee reporting processes, employee inquiry process, employee information and data, and the HR information systems. Create and administer the employee metrics. Develop and handle the time and attendance systems. Refurbish the indicators for employee retention and motivation.', '7'),
('35', '17057', '7.8', 'Manage employee communication', 'Creating an effective plan that initiates and promotes communication and engagement among the employees and between employees and management.', '7'),
('36', '10532', '7.9', 'Deliver employee communications', 'Implementing the communication plan for employees. Initiate dialogues and engagement by monitoring the exchange of ideas and opinions, the development of personal relationships, etc.', '7'),
('37', '12859', '7.10', 'Manage union relations', NULL, '7'),
('38', '20608', '8.1', 'Develop and manage IT customer relationships', 'Creating and administering relationships with IT customers. Understanding customer needs including high-level business requirements for IT transformation. Plan for and communicate IT services along with establishing IT service levels, providing transformation guidance, and performance analysis that foster IT customer relationships.', '8'),
('39', '20652', '8.2', 'Develop and manage IT business strategy', 'Handling the business of IT. Create a organization-wide strategy for the IT function. Define the organization''s IT architecture. Manage the IT portfolio. Research and innovate in the field of IT. Assess and convey the performance and the value of the IT function.', '8'),
('40', '20706', '8.3', 'Develop and manage IT resilience and risk', 'Develop and include the processes required to rapidly adapt and respond to any internal or external opportunity, demand, disruption, or threat to IT. Develop a more dynamic, strategic, and integrated approach to managing risk and compliance obligations.', '8'),
('41', '20765', '8.4', 'Manage information', 'Creating strategies to manage the organization''s information and content. Outline the architecture for information. Administer information resources. Administer the management of data and content. ', '8'),
('42', '20784', '8.5', 'Develop and manage services/solutions', 'Designing and maintaining the IT services/solutions catalogue. Evaluate the performance of IT services/solutions. Communicate the results to the management.', '8'),
('43', '20824', '8.6', 'Deploy services/solutions', 'Executing IT services/solutions by creating a strategy for deployment. Plan and execute the changes. Plan and administer the release of its IT services and solutions.', '8'),
('44', '20866', '8.7', 'Create and manage support services/solutions', 'Establishing and managing services for providing support to users of IT services and solutions. Define the plethora of services by which the organization assists users of computers, software products, or other information technology products.', '8'),
('45', '10728', '9.1', 'Perform planning and management accounting', 'Determining different stages of the planning process and accounting. Classify, determine, analyze, interpret, and communicate information to make up-to-date business decisions for better management and control functions.', '9'),
('46', '10729', '9.2', 'Perform revenue accounting', 'Comparing revenue targets to reality. Review all transactions and entries passed in final accounts in a year in order to examine profits.', '9'),
('76', '20959', '13.8', 'Develop, Manage, and Deliver Analytics', 'Creating new and improving existing analytical capabilities to enhance data management pipeline. ', '13'),
('47', '10730', '9.3', 'Perform general accounting and reporting', 'Making statements about business activities and functions. Prepare financial statements (balance sheet, income statement, statement of cash flows, and statement of stockholders'' equity) according to accounting concepts and principles.', '9'),
('48', '10731', '9.4', 'Manage fixed-asset project accounting', 'Managing accounts for large funds-invested projects. Manage and account for fixed assets projects (capital projects), which required significant capital investments over many years.', '9'),
('49', '10732', '9.5', 'Process payroll', 'Handling reporting time, managing pay, and processing taxes from salaries. Pay employees. Withhold taxes. Confirm the correct funds are paid to the correct government agency.', '9');

INSERT INTO automation_hub.apqc_process_group (id, pcf_id, hierarchy_id, name, description, category_id) VALUES
('50', '10733', '9.6', 'Process accounts payable and expense reimbursements', 'Handling bills and reimbursements to be made. Make payments for goods or services taken or used on behalf of the organization.', '9'),
('51', '10734', '9.7', 'Manage treasury operations', 'Managing business''s investments in trading in bonds, currencies, financial derivatives, etc. Manage the financial assets and holdings of the organization. Optimize the organization''s liquidity. Invest excess cash. Reduce financial risks.', '9'),
('52', '10735', '9.8', 'Manage internal controls', 'Administering internal controls. This process requires the organization to manage entity''s board of trustees, management, and other personnel in order to offer judicious assurance about the achievement of effectiveness, proficiency of operations, and reliability of financial reporting.', '9'),
('53', '10736', '9.9', 'Manage taxes', 'Estimating the organization''s periodic tax liabilities. Ensure that appropriate taxing authorities receive tax return filings and payments when due.', '9'),
('54', '10737', '9.10', 'Manage international funds/consolidation', 'Managing cash collections and disbursements made by operating units across the enterprise. When appropriate, transfer cash from the operating units to parent-level bank accounts managed by the organization''s treasury team.', '9'),
('55', '17059', '9.11', 'Perform global trade services', 'Making and collecting payments for transactions in products/services, and transporting them to interested markets.', '9'),
('56', '10937', '10.1', 'Plan and acquire assets', 'Planning, acquiring, and managing facilities, workspaces, and supporting assets. Acquire, configure, and manage facilities and workspaces, to include supporting equipment and materials.', '10'),
('57', '19208', '10.2', 'Design and construct productive assets', 'Conceptualizing and realizing dividend and income generating assets such as machines, tools, factories, etc. Manage steps to acquire assets including managing capital, as well as planning, scheduling, and overseeing construction.', '10'),
('58', '19238', '10.3', 'Maintain productive assets', 'Preserving productive assets through the planning, managing, and performance of preventative, routine, and critical maintenance work. ', '10'),
('59', '10940', '10.4', 'Dispose of assets', 'Retiring productive and non-productive assets. ', '10'),
('60', '17060', '11.1', 'Manage enterprise risk', 'Creating requisite frameworks and coordinating all risk management activities for the entire organization and each function. Manage the enterprise risk by outlining the risk policies and procedures. Monitor and communicate all risk management activities. Encourage correspondence among the business units. Manage the risk of all business units and functions.', '11'),
('61', '17467', '11.2', 'Manage compliance', 'Managing steps to confirm enduring compliance to industry regulations and government legislation.', '11'),
('62', '11185', '11.3', 'Manage remediation efforts', 'Administering the efforts and activities for remediation. This process element requires the organization to create plans for corrective action in collaboration with government agencies and pertinent professional services agencies which specialize in remediation efforts relevant to the organization''s operations. Additionally, the organization needs to consult experts to validate the plan, determine resources allocation, resolve any legal concerns, and formulate a company-wide policy for remediation.', '11'),
('63', '11216', '11.4', 'Manage business resiliency', 'Including the processes required to rapidly adapt and respond to any internal or external opportunity, demand, disruption, or threat. Develop a more dynamic, strategic, and integrated approach to managing compliance obligations.', '11'),
('64', '11010', '12.1', 'Build investor relationships', 'Creating a strategic management responsibility for integrating finance, communication, marketing, and securities law compliance. Allow the most effective two-way communication among the organization, the financial community, and other constituencies. Enlist the investor relations function to provide market intelligence to corporate management.', '12'),
('65', '11011', '12.2', 'Manage government and industry relationships', 'Creating and maintaining relationships with government and industry representatives. ', '12'),
('66', '11012', '12.3', 'Manage relations with board of directors', 'Maintaining relations with representatives of the stockholders. Establish corporate management-related policies and to make decisions on major company issues. Implement practices designed to engender communication, trust, and cooperation.', '12'),
('67', '11013', '12.4', 'Manage legal and ethical issues', 'Managing legal practices to abide by the law, as well as ethical practices.', '12'),
('68', '11014', '12.5', 'Manage public relations program', 'Managing a public relations programs through business and communications skills. ', '12'),
('69', '16378', '13.1', 'Manage business processes', 'Establishing and administering governance for management of the processes. Outline and manage the frameworks for management of the processes. Define the business processes. Administer the performance of the processes. Enhance the business processes.', '13'),
('70', '16400', '13.2', 'Manage portfolio, program, and project', 'Managing investments, holdings, products, businesses, and brands, along with the related projects that together constitute a program.', '13'),
('71', '17471', '13.3', 'Manage enterprise quality', 'Managing organizational attributes that are closely associated with the quality of output. Determine the quality requirements. Evaluate the correspondence between the quality performance and requirements. Manage non-conformance activities. Ensure implementation and maintenance of the enterprise quality management system. ', '13'),
('72', '11074', '13.4', 'Manage change', 'Planning, designing, and implementing the change. Ensure improvement in the change process.', '13'),
('73', '11073', '13.5', 'Develop and manage enterprise-wide knowledge management (KM) capability', 'Creating and administering the capability of the organization''s knowledge management function. Develop a strategy for knowledge management. Assess capabilities of the knowledge management function. ', '13'),
('74', '16436', '13.6', 'Measure and benchmark', 'Creating and administering a strategy to manage organizational performance. Benchmark the performance of the internal processes, as well as the organization as a whole.', '13'),
('75', '11179', '13.7', 'Manage environmental health and safety (EHS)', 'Determining the impacts of environmental health and safety. Create and implement the EHS program. Train and educate employees of the EHS function. Oversee and manage the EHS program. ', '13');
