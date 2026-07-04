"use client";

import { useState } from "react";
import { ACTOR_TYPES, ACTOR_LABELS } from "@/lib/constants";
import { Field, Select, TextInput } from "@/components/ui/Field";

interface PersonOption {
  id: string;
  firstName: string;
  lastName: string;
}

/**
 * "Who performed this action / who is this linked to" — a lightweight actor
 * picker (Oscar, Cristina, employee, freelancer, intern, contractor, vendor,
 * client, other) with an optional link into a full HR profile. Deliberately
 * not a permissions system, just a label.
 */
export function ActorSelect({
  people,
  namePrefix = "actor",
  defaultType,
  defaultLabel,
  defaultPersonId,
  label = "Who is this linked to?",
}: {
  people: PersonOption[];
  namePrefix?: string;
  defaultType?: string;
  defaultLabel?: string;
  defaultPersonId?: string | null;
  label?: string;
}) {
  const [type, setType] = useState(defaultType ?? "OSCAR");
  const showPersonPicker = ["EMPLOYEE", "FREELANCER", "INTERN", "CONTRACTOR"].includes(type);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Field label={label}>
        <Select
          name={`${namePrefix}Type`}
          options={ACTOR_TYPES.map((t) => ({ value: t, label: ACTOR_LABELS[t] }))}
          defaultValue={defaultType ?? "OSCAR"}
          onChange={(e) => setType(e.target.value)}
        />
      </Field>
      {showPersonPicker && people.length > 0 ? (
        <Field label="Linked HR profile">
          <Select
            name={`${namePrefix}PersonId`}
            options={people.map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }))}
            placeholder="(not in HR yet)"
            defaultValue={defaultPersonId ?? ""}
          />
        </Field>
      ) : (
        <div />
      )}
      <Field label="Name / label">
        <TextInput name={`${namePrefix}Label`} defaultValue={defaultLabel} placeholder="e.g. Oscar" />
      </Field>
    </div>
  );
}
