# Week 6 - Software Requirements Specification

## Problem

Record backend technology choices and integrity constraints in the SRS.

## Relevant Context

The SRS consolidated the functional requirements, interfaces, feasibility findings and quality targets.

## Key Observation

Two requests may arrive for the same slot. The backend design calls for checking availability while applying the booking update so concurrent actions preserve the scheduling rule.

## Solution

I worked on technology selection, constraints and feasibility. The proposed stack uses Node.js for service logic, PostgreSQL for persistent data, bcrypt for password hashing and JWT for session authentication. I linked the scheduling design to FR-04 for conflict checking and recorded the need for a transaction that preserves a consistent booking state. The SRS documented the proposed stack and the constraints on authorization, persistence and booking consistency.

## Next Steps

Connect notification and administration scenarios to the backend design.

[Back to journal index](index.md)
