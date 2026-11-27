# Week 4 - Activity and swimlane diagrams

## Problem

Model the system activities in the booking and notification workflow.

## Relevant Context

The activity and swimlane diagrams established how the request moves between the student, system, professor and notifications.

## Key Observation

A notification belongs to a specific meeting event. I linked notification generation to the relevant request creation or status update.

## Solution

I worked on the system and notification activities in the swimlane model. I mapped credential validation, slot checking, pending request creation, professor decisions and notification dispatch. I identified where the system updates the appointment record and where it reports a failure back to the requester. The workflow established the order of backend operations and their external handoffs.

## Next Steps

Expand the system activities into detailed data flow diagrams.

[Back to journal index](index.md)
