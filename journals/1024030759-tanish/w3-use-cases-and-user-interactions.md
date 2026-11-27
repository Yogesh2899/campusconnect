# Week 3 - Use cases and user interactions

## Problem

Derive service behavior from the detailed use cases.

## Relevant Context

The use-case model identified the Student, Professor and Administrator actors and specified their interactions.

## Key Observation

Use cases share some steps and have different failure conditions. I recorded those preconditions and outcomes alongside the relevant service action.

## Solution

I worked on administrator use cases and relationships among the documented workflows. I traced backend prerequisites for login, availability checks and status changes. The booking flow requires an authenticated student and an available slot, and its successful outcome is a pending request associated with the relevant student and professor. The use cases gave the backend design clear permissions, inputs and expected outcomes.

## Next Steps

Trace when the backend validates requests, writes records and sends updates.

[Back to journal index](index.md)
