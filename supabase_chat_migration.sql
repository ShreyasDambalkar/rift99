-- ═══════════════════════════════════════════════════════════════════
--   PharmaGuard – Full Schema Reset
--   Paste this entire script into Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════════

-- ── DROP EVERYTHING FIRST (fresh start) ─────────────────────────────────
drop policy if exists "Auth users can upload vcf"    on storage.objects;
drop policy if exists "Auth users can read own vcf"  on storage.objects;
drop policy if exists "Auth users can delete own vcf" on storage.objects;

drop table if exists chat_messages  cascade;
drop table if exists reports        cascade;
drop table if exists doctor_patients cascade;
drop table if exists profiles       cascade;


-- ════════════════════════════════════════════════════════════════════
--  1. PROFILES
--     One row per user. Created during onboarding.
-- ════════════════════════════════════════════════════════════════════
create table profiles (
    id         uuid primary key references auth.users(id) on delete cascade,
    role       text check(role in ('doctor','patient')),
    name       text,
    hospital   text,
    created_at timestamp default now()
);

alter table profiles enable row level security;

-- Own profile: full access
create policy "Own profile"
    on profiles for all
    using (id = auth.uid());

-- NOTE: "Patients can view linked doctor profile" policy is added
-- AFTER doctor_patients table is created (see below)


-- ════════════════════════════════════════════════════════════════════
--  2. DOCTOR_PATIENTS
--     Doctor creates a row per patient with a generated code.
--     When the patient signs up with the code, patient_id is filled in.
-- ════════════════════════════════════════════════════════════════════
create table doctor_patients (
    id           uuid primary key default gen_random_uuid(),
    doctor_id    uuid not null references auth.users(id) on delete cascade,
    patient_name text not null,
    patient_code text unique not null,
    patient_id   uuid references auth.users(id) on delete set null,
    created_at   timestamp default now()
);

alter table doctor_patients enable row level security;

-- Doctors manage their own rows
create policy "Doctors manage own patients"
    on doctor_patients for all
    using (doctor_id = auth.uid());

-- Patients can read their own linked slot
create policy "Patients read own slot"
    on doctor_patients for select
    using (patient_id = auth.uid());

-- Anyone authenticated can look up a row by patient_code (for linking during signup)
create policy "Allow lookup by patient_code"
    on doctor_patients for select
    to authenticated
    using (
        doctor_id = auth.uid() or patient_id = auth.uid() or patient_id is null
    );

-- Patient can claim an unclaimed slot (linking step)
create policy "Allow patient to claim their slot"
    on doctor_patients for update
    to authenticated
    using (patient_id is null)
    with check (patient_id = auth.uid());

-- Patients can read their linked doctor's profile
-- (added here because it references doctor_patients)
create policy "Patients can view linked doctor profile"
    on profiles for select
    using (
        id in (
            select doctor_id from doctor_patients where patient_id = auth.uid()
        )
    );


-- ════════════════════════════════════════════════════════════════════
--  3. REPORTS
--     Saved pharmacogenomic analysis results per patient.
-- ════════════════════════════════════════════════════════════════════
create table reports (
    id            uuid primary key default gen_random_uuid(),
    owner_user_id uuid not null references auth.users(id) on delete cascade,
    dp_id         uuid references doctor_patients(id) on delete cascade,
    vcf_file_url  text,
    result_json   jsonb,
    created_at    timestamp default now()
);

alter table reports enable row level security;

-- Doctors manage reports they created
create policy "Doctors manage own reports"
    on reports for all
    using (owner_user_id = auth.uid());

-- Patients can read reports linked to them
create policy "Patients see their reports"
    on reports for select
    using (
        exists (
            select 1 from doctor_patients
            where doctor_patients.id = reports.dp_id
              and doctor_patients.patient_id = auth.uid()
        )
    );


-- ════════════════════════════════════════════════════════════════════
--  4. CHAT_MESSAGES
--     Real-time messages between doctors and their linked patients.
-- ════════════════════════════════════════════════════════════════════
create table chat_messages (
    id          uuid primary key default gen_random_uuid(),
    sender_id   uuid not null references auth.users(id) on delete cascade,
    receiver_id uuid not null references auth.users(id) on delete cascade,
    message     text not null,
    read        boolean default false,
    created_at  timestamptz default now()
);

create index idx_chat_sender   on chat_messages(sender_id);
create index idx_chat_receiver on chat_messages(receiver_id);
create index idx_chat_created  on chat_messages(created_at asc);

alter table chat_messages enable row level security;

-- Users can send messages as themselves
create policy "Users can send messages"
    on chat_messages for insert
    with check (auth.uid() = sender_id);

-- Users can read messages they sent or received
create policy "Users can read their conversations"
    on chat_messages for select
    using (auth.uid() = sender_id or auth.uid() = receiver_id);


-- ════════════════════════════════════════════════════════════════════
--  5. STORAGE POLICIES  (bucket "vcf-files" must exist already)
--     Create bucket manually: Storage → New Bucket → "vcf-files" → Public ON
-- ════════════════════════════════════════════════════════════════════
create policy "Auth users can upload vcf"
    on storage.objects for insert
    to authenticated
    with check (
        bucket_id = 'vcf-files'
        and auth.uid()::text = (storage.foldername(name))[1]
    );

create policy "Auth users can read own vcf"
    on storage.objects for select
    to authenticated
    using (
        bucket_id = 'vcf-files'
        and auth.uid()::text = (storage.foldername(name))[1]
    );
