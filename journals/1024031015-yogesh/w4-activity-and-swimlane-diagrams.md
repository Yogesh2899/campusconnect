# Week 4 - Activity and swimlane diagrams

## Problem

Trace decisions and handoffs through the booking workflow.

## Relevant Context

The activity and swimlane diagrams established how the request moves between the student, system, professor and notifications.

## Key Observation

A diagram can make a request look like a completed booking. I checked when the request becomes pending and when the professor's decision changes its status.

## Solution

I followed the student path from login through slot selection and request submission, then checked the system and professor handoffs in the swimlane diagram. I used the invalid-login and unavailable-slot branches to identify where processing should stop. I also checked that appointment status updates and notifications followed the relevant decisions. The diagrams provided an end-to-end checklist for the main paths and failure branches.

## Next Steps

Relate the workflow checkpoints to the system boundary and data flows.

[Back to journal index](index.md)
