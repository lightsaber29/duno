-- 이미 schema.sql(2026-10-14 첫 판)을 실행한 DB에만 한 번 실행. 새 DB는 schema.sql만 실행하면 된다.
-- 기타(subgoal_id null)를 저장할 수 있게 entry_shares의 키를 바꾼다.
alter table entry_shares drop constraint entry_shares_pkey;
alter table entry_shares alter column subgoal_id drop not null;
drop index if exists entry_shares_one_other;
alter table entry_shares add column id bigint generated always as identity primary key;
alter table entry_shares add constraint entry_shares_entry_subgoal_key unique nulls not distinct (entry_id, subgoal_id);
