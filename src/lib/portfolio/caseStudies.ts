// src/lib/portfolio/caseStudies.ts

export type PortfolioPlatform = 'Poki' | 'CrazyGames' | 'itch.io' | 'Vercel' | 'Netlify' | 'Cloudflare' | 'Other';

export type IssueTag =
  | 'Black screen'
  | 'WASM MIME'
  | 'Compression'
  | 'Caching'
  | 'Cross-origin / COOP/COEP'
  | 'Large build size'
  | 'Platform rejection'
  | 'Load time';

export type CaseStudyStatus = 'verified' | 'in_progress';

export type CaseStudy = {
  slug: string;
  status?: CaseStudyStatus; // default: 'verified'
  title: string;
  oneLiner: string;

  clientType: 'Indie dev' | 'Studio' | 'Agency' | 'Student' | 'Other';
  platform: PortfolioPlatform;
  host: PortfolioPlatform;

  timeframe: string; // e.g. "Same day", "24 hours", "In progress"

  outcome: {
    headline: string; // “Live + verified”
    bullets: string[];
  };

  issues: IssueTag[];

  // Optional extras
  stackNotes?: string[];
  before: string[];
  after: string[];
  deliverables: string[];

  testimonial?: {
    quote: string;
    name?: string;
    where?: 'Fiverr' | 'Upwork' | 'Email';
  };

  links?: {
    liveUrl?: string;
    platformSubmission?: string;
  };
};

export const caseStudies: CaseStudy[] = [
  // ✅ VERIFIED (example)
  {
    slug: 'vercel-black-screen-fix',
    status: 'verified',
    title: 'Vercel deployment: black screen → running build',
    oneLiner: 'Unity WebGL build worked locally, failed online. Deployed correctly and verified live on Vercel.',
    clientType: 'Indie dev',
    platform: 'Vercel',
    host: 'Vercel',
    timeframe: 'Same day',
    issues: ['Black screen', 'WASM MIME', 'Compression', 'Caching'],
    outcome: {
      headline: 'Live + verified',
      bullets: [
        'Correct headers for WASM + data files',
        'Compression configuration aligned with Unity output',
        'Cache behavior fixed for update-safe deployments',
      ],
    },
    before: [
      'Build ran locally but showed a black screen when hosted',
      'Browser console showed MIME / loading errors',
      'Deployments would “sometimes work” then fail after refresh',
    ],
    after: [
      'Build loads consistently on first load + refresh',
      'Correct Content-Type served for WASM and related assets',
      'Caching tuned to prevent stale build loading',
    ],
    deliverables: [
      'Working deployment config',
      'Verification checklist + quick handover notes',
      'Optional re-deploy guide for future builds',
    ],
    testimonial: {
      quote: 'Got it live the same day. No more black screen — runs perfectly now.',
      where: 'Email',
    },
  },

  // 🟡 IN PROGRESS (placeholder — intentional)
  {
    slug: 'crazygames-launch-in-progress',
    status: 'in_progress',
    title: 'CrazyGames readiness: deployment verification + platform alignment',
    oneLiner: 'Case study in progress — verifying headers, compression, caching, and platform checks.',
    clientType: 'Indie dev',
    platform: 'CrazyGames',
    host: 'Cloudflare',
    timeframe: 'In progress',
    issues: ['Platform rejection', 'Compression', 'Caching', 'Load time'],
    outcome: {
      headline: 'In progress',
      bullets: ['Verification checklist being run', 'Platform constraints being validated'],
    },
    before: ['Build works locally', 'Platform/host requirements need alignment'],
    after: ['(Will be updated with verified outcome)'],
    deliverables: ['Deployment verification report', 'Final config + go-live verification'],
  },

  // 🟡 IN PROGRESS (placeholder — intentional)
  {
    slug: 'poki-launch-in-progress',
    status: 'in_progress',
    title: 'Poki launch: host configuration + consistent first-load',
    oneLiner: 'Case study in progress — focusing on first-load stability and platform acceptance.',
    clientType: 'Studio',
    platform: 'Poki',
    host: 'Netlify',
    timeframe: 'In progress',
    issues: ['Load time', 'Compression', 'Platform rejection'],
    outcome: {
      headline: 'In progress',
      bullets: ['Testing candidate builds', 'Capturing before/after evidence'],
    },
    before: ['Intermittent load failures reported', 'Submission requirements not fully met'],
    after: ['(Will be updated with verified outcome)'],
    deliverables: ['Platform-ready deployment', 'Submission checklist + handover'],
  },
];

export const allPlatforms: PortfolioPlatform[] = ['Poki', 'CrazyGames', 'itch.io', 'Vercel', 'Netlify', 'Cloudflare', 'Other'];

export const allIssueTags: IssueTag[] = [
  'Black screen',
  'WASM MIME',
  'Compression',
  'Caching',
  'Cross-origin / COOP/COEP',
  'Large build size',
  'Platform rejection',
  'Load time',
];
