import { meetById, SKILL } from './data.js';
import { NPC_NAMES, type MeetRecord, type Result, type Rider, type Run, type Settings, type Standing } from './types.js';

export function featureMatch(record: Pick<MeetRecord, 'id' | 'division'>) {
  const meet = meetById(record.id);
  if (meet?.international) return '국제대회';
  if (record.division === 'master' && meet?.id === 'festival') return '마스터부 시즌 결승';
}

export function skipsMatch(settings: Settings, record: Pick<MeetRecord, 'id' | 'division'>) {
  return !!settings.skipMeets && !(settings.watchMajor && featureMatch(record));
}

export function closingSkill(run: Run) {
  return run.log.findLast(move => (SKILL[move.id]?.difficulty ?? 0) >= 3);
}

const scoreTenths = (standing: Standing) => Math.round(standing.score * 10);
const crowdLines: Record<keyof typeof NPC_NAMES, [win: string, loss: string, tie: string]> = {
  yu: ['그 마지막 박자, 다시 보고 싶어!', '다음엔 내가 관중석에서 더 크게 응원할게!', '우리 점수가 나란히 떴어!'],
  jun: ['좋았어! 영상 끝까지 남겨 둬야겠다.', '방금 영상, 같이 볼래? 다음엔 또 붙자.', '이 점수표 저장한다. 다음에도 붙자!'],
  sol: ['오늘 라인은 네가 가져갔네. 축하해.', '끝까지 탔잖아. 다음 라인은 어디서 시작할래?', '점수표에 이름이 나란히 올라가니 보기 좋네.'],
  min: ['연습한 게 무대에서도 보였어. 축하해.', '오늘 영상 같이 보자. 어느 구간부터 볼까?', '같은 순위여도 서로 배울 동작은 있겠네.'],
  ha: ['잘 탔어. 오늘 건 기억해 둘게.', '수고했어. 보드 챙겨, 한 바퀴 돌자.', '다음엔 한 칸 더 올라가자.'],
  noa: ['점수가 뜨기 전부터 한 번 더 보고 싶었어.', '난 아까 동작이 기억에 남았어. 다음에도 보여 줘.', '오늘 라인은 둘 다 기억에 남을 것 같아.'],
};

export function matchPresentation(rider: Rider, record: MeetRecord, result: Result, live: boolean) {
  const player = result.standings.find(row => row.id === 'player');
  if (!player) return;
  const opponents = result.standings.filter(row => row !== player);
  const leader = opponents.reduce<Standing | undefined>((best, row) => !best || row.place < best.place ? row : best, undefined);
  const scoreGap = (row: Standing) => Math.abs(scoreTenths(player) - scoreTenths(row)) / 10;
  const nearestAhead = opponents.filter(row => row.place < player.place).reduce<Standing | undefined>((best, row) => !best || scoreGap(row) < scoreGap(best) ? row : best, undefined);
  const tied = opponents.find(row => row.place === player.place);
  const won = player.place === 1;
  const rival = tied ?? (won ? leader : nearestAhead);
  const gap = rival === undefined ? undefined : scoreGap(rival);
  const close = gap !== undefined && gap > 0 && gap <= 2;
  const title = tied ? `공동 ${player.place}위` : won ? close && player.score > rival!.score ? '역전 우승!' : '우승!' :
    close ? '아쉬운 접전' : `${player.place}위로 마쳤다`;

  const week = meetById(record.id)?.week ?? 0;
  const earlier = rider.records.flatMap(before => {
    const previousWeek = meetById(before.id)?.week ?? 0;
    if (before.year > record.year || before.year === record.year && previousWeek >= week) return [];
    return before.results.filter(run => run.discipline === result.discipline)
      .map(run => ({ run, year: before.year, week: previousWeek }));
  }).sort((a, b) => b.year - a.year || b.week - a.week);
  const best = Math.max(-Infinity, ...earlier.map(({ run }) => run.run.score));
  const personalBest = earlier.length > 0 && result.run.score > best ? best : undefined;
  const isNpc = (id: string): id is keyof typeof NPC_NAMES => Object.hasOwn(NPC_NAMES, id);
  const known = opponents.filter(row => isNpc(row.id));
  const rematch = known.filter(row => {
    const previous = earlier.find(({ run }) => run.standings.some(opponent => opponent.id === row.id));
    const prevPlayer = previous?.run.standings.find(opponent => opponent.id === 'player');
    const prevNpc = previous?.run.standings.find(opponent => opponent.id === row.id);
    return !!prevPlayer && !!prevNpc && prevNpc.place < prevPlayer.place;
  }).sort((a, b) => Number(b.id === rival?.id) - Number(a.id === rival?.id) || scoreGap(a) - scoreGap(b))[0];
  const supporter = live ? known.filter(row => (rider.relations[row.id] ?? 0) >= 50)
    .sort((a, b) => (rider.relations[b.id] ?? 0) - (rider.relations[a.id] ?? 0))[0] : undefined;
  const candidate = supporter ?? (live ? rematch : undefined);
  const speaker = candidate && (close || rematch || featureMatch(record)) &&
    rider.extras?.relationships?.npcs[candidate.id]?.state !== 'ended' ? candidate : undefined;
  const reaction = speaker && isNpc(speaker.id) ? {
    name: speaker.name,
    line: crowdLines[speaker.id][player.place < speaker.place ? 0 : player.place > speaker.place ? 1 : 2],
  } : undefined;
  return { player, leader, rival, gap, title, close, tied: !!tied, personalBest, rematch, reaction };
}
