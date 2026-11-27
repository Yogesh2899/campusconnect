# Week 3 - Use cases and user interactions

## Problem

Use the documented use cases to identify successful and unsuccessful paths.

## Relevant Context

The use-case model identified the Student, Professor and Administrator actors and specified their interactions.

## Key Observation

Several actions share an authentication prerequisite. I recorded session checks separately from each action's booking or cancellation rules.

## Solution

I focused on student use cases for availability, meeting requests and cancellations. I used their preconditions and postconditions to outline expected behavior for a valid request, an unauthenticated request and a request for an unavailable slot. A successful request should create a pending record. An unsuccessful request should leave the schedule intact. The student use cases provided test conditions and expected changes to meeting records.

## Next Steps

Trace success and refusal paths through the activity diagrams.

[Back to journal index](index.md)
