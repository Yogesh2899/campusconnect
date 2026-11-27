# Week 5 - Data flow diagrams

## Problem

Identify the information the frontend needs from scheduling and availability services.

## Relevant Context

The team used three levels of data flow diagrams to connect external interactions to internal processes and records.

## Key Observation

Availability can change between browsing and submission. I accounted for a conflict response and a way to refresh the displayed slots.

## Solution

I reviewed the availability and meeting data flows to identify the data needed by each screen. The student view needs a professor, slot times and current availability. The professor request view needs the requested time, meeting details and current status. These values also guide refresh behavior after an update. The DFDs informed the planned frontend inputs and server response states.

## Next Steps

Record the interface and usability requirements in the SRS.

[Back to journal index](index.md)
