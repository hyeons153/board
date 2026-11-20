import { AUTO_FLOW } from './data.js';
import type { CareerExtras } from './economy.js';
import { happeningDuration } from './happenings.js';
import type { EventOutcome, MeetRecord } from './types.js';
import { featureMatch } from './matchPresentation.js';

export function trainingResultDuration(result: CareerExtras['lastTraining']) {
  return result?.special || result?.joint?.focus || result?.grade === 'injury' ||
    result?.grade === 'learned' || result?.grade === 'mastery' ? AUTO_FLOW.resultMs : 850;
}

export function eventResultDuration(result: EventOutcome) {
  if (result.happening) return happeningDuration(result.dialogue ?? '');
  return result.afterMeet || result.dialogue ? AUTO_FLOW.resultMs : 1000;
}

export function ceremonyDuration(record: MeetRecord, full: boolean) {
  return full && featureMatch(record) ? 3600 : AUTO_FLOW.ceremonyMs;
}
