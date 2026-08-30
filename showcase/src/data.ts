export const concept = {
  company: 'Tamarack Renewables',
  label: 'Concept demo',
  product: 'Tamarack FieldOps',
};

export const operationsCopy = {
  title: 'Field operations',
  description: 'Keep every site inside its safe operating window.',
  primaryAction: 'Log event',
  secondaryAction: 'Export brief',
};

export const sites = [
  {
    name: 'North Sound',
    type: 'Wind',
    state: 'Stable',
    output: '36 MW',
    focus: 'Blade inspection',
    updated: 'Today 14:20',
  },
  {
    name: 'Quartz Ridge',
    type: 'Solar',
    state: 'Watch',
    output: '18 MW',
    focus: 'Inverter cluster 4',
    updated: 'Today 12:10',
  },
  {
    name: 'Cedar Basin',
    type: 'Hydro',
    state: 'Stable',
    output: '27 MW',
    focus: 'Spillway sensor',
    updated: 'Yesterday',
  },
];

export const aiReview = {
  title: 'Review outage note',
  description: "Check the model's draft against approved field evidence.",
  draft:
    'North Sound turbine 07 is paused for a blade inspection. The service crew is booked for Tuesday morning. Expected output remains inside the weekly operating range.',
  uncertainty:
    'The repair window is provisional until the marine forecast is confirmed.',
  sources: [
    {
      title: 'Work order WO-184',
      detail: 'Crew booked for Tuesday, 08:30. Access depends on marine conditions.',
    },
    {
      title: 'Site log, 30 August',
      detail: 'Turbine 07 paused at 14:06 after the inspection threshold was reached.',
    },
  ],
  primaryAction: 'Approve draft',
  secondaryAction: 'Request changes',
};

export const marketing = {
  title: 'See every site clearly.',
  description:
    'One operating view for wind, solar, and hydro teams. Spot risk early, assign work, and close the loop.',
  primaryAction: 'Book a field review',
  secondaryAction: 'Explore the workflow',
  proof: ['3 energy types', '1 operating view', 'Human approval'],
};
