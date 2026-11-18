# 캐릭터 아트 적용 기록

2026-11-18. 사용자 제공 남녀 캐릭터 설정화와 방향별 이미지, 동작표를 바탕으로 기존 단순 도형 캐릭터를 전신 스프라이트로 교체했다. 내장 이미지 도구로 배경을 분리하고 방향별 그림을 준비했다. 생성 과정에서 작은 디테일이 달라질 수 있으므로 원본 파일과 픽셀이 완전히 같다는 의미는 아니다. 머리·몸 비율과 의상·신발 형태를 유지하는 것을 우선했다.

## 저장한 이미지

- `source-v2.png`: 남녀 10명 정면 전신의 배경 분리 결과.
- `male-turnaround-v2.png`: 남성 5명 정면·측면·후면.
- `female-turnaround-v2.png`: 여성 5명 정면·양 측면·후면.
- `school-turnaround-v2.png`: 설정화의 추가 여성 코디와 번·리본 헤어, 정면·측면·후면.
- 실제 게임 자산: `public/art/characters/riders-v2.png` (960×2688, 15개 베이스×4방향). 원본 제작 이미지는 배포에 포함하지 않는다.

`npx tsx scripts/prepare-character-art.ts`가 투명한 캐릭터의 연결된 영역을 정리해 스케일과 바닥 기준을 맞춘다. 색과 내부 그림을 도형으로 다시 그리지 않는다. `spriteCharacter.ts`가 머리·몸통·팔·다리·신발 레이어를 조합하고 관절에 연결한다. 기본 자세는 소스 그림의 픽셀과 비율을 그대로 조립하는 검증을 통과한다. 움직일 때는 관절 변형과 회전 방향별 그림을 사용한다. 목 연결점을 가슴보다 위에 고정했다.

처음 필요한 베이스와 코디만 분리하고 각 캐시를 16개로 제한해 모든 조합을 메모리에 만들지 않는다. 게임과 프로필은 2배 해상도의 동일 자산을 사용한다. 커리어 기록이나 DB 형식을 변경하지 않는다.

## 사용한 프롬프트 세트

방식: 내장 이미지 도구, 투명 배경. 입력 이미지는 사용자가 제공한 설정화이며 편집 대상으로 지정했다. 다음은 각 결과에 사용한 보존 조건과 구성이다.

1. `source-v2.png`: “Use case: background-extraction / identity-preserve. Asset type: transparent game sprite atlas. The two input images are EDIT TARGETS, not loose style references. Extract and preserve the EXACT ten original full-body pixel characters including their entire original hair, faces, eyes, heads, necks, shoulders, body proportions, clothing texture and shading, sleeves, hands, cargo pants/skirts, legs and chunky shoes. Arrange the five boys left-to-right in the top row and five girls left-to-right in the bottom row. 5 equal-width columns, 2 equal-height rows. Preserve the original relaxed standing pose and neutral expressions, in particular the original clearly visible collar/neck and full body lengths. Change ONLY the background to genuine transparency and the grid arrangement. No restyling, no simplified geometry, no squeezed torso, no oversized head touching chest, no extra props, no skateboards, no cast shadows, no words, no dividers, no labels. Keep crisp original pixel outlines and detailed interior pixel shading.”
2. `male-turnaround-v2.png`: “Use case: background-extraction, identity-preserve. Edit target: the MALE character turnarounds in the TOP HALF of image1. Image2 male top row is supporting high-detail identity reference. Produce a production PNG sprite atlas on TRUE TRANSPARENCY, with 5 equal columns and 3 equal rows. Each column is ONE exact supplied original boy: brown/red jacket; blond/purple varsity; orange/teal hoodie; dark purple/dark hoodie; silver/green jacket. Row1 FRONT, row2 PROFILE FACING RIGHT, row3 BACK. 15 FULL BODY figures total, every figure entirely inside its own cell. Preserve original hair tuft and eye styling, full head-to-body proportions, VISIBLE NECK between chin and collar, full-length torso and legs, bulky detailed sleeves, pocket flaps, chunky shoes, original palette and pixel shading. Remove all reference card frames, typography, palette swatches, decorative background and ground shadows. Entire background must be alpha0, no gradients, no glow. NOT a new cute interpretation.”
3. `female-turnaround-v2.png`: “Use case: background-extraction, identity-preserve. Edit target: image1's ORIGINAL female turnarounds. Image2 supplies the same five original front characters in more detail. Make an actual transparent game sprite atlas, five equal columns and four equal rows, 20 full-body sprites total. KEEP exact originals with unchanged faces/hair/body/clothing and shoe detail: brown bob/red jacket/cargo; brown high ponytail/cream cropped hoodie/joggers; brown twin tails/green varsity/pleated skirt/leggings; dark long straight hair/purple hoodie/cream sling pouch and skirt/leggings; blond waves/green varsity/cargo shorts. Row1 FRONT, row2 RIGHT PROFILE, row3 BACK, row4 LEFT PROFILE. Preserve original head-to-body ratio, visible neck, full torso length, baggy sleeves and legs, all shading and dark pixel outlines. Do not squash figures or enlarge heads. Remove ONLY diagram frames, text, white background, gray floor shadows. Background must be true alpha0.”
4. `school-turnaround-v2.png`: “Use case: background-extraction, identity-preserve. EDIT TARGET is the bottom FEMALE row of the first supplied character setting sheet; second image is a supporting identity reference for the pink-haired girl. Extract and preserve these EXACT five original girls as a true alpha-transparent sprite atlas: 5 equal columns, 3 equal rows. Long wavy PINK hair/dusty pink jacket/dark skirt; BLOND twin tails/navy sailor; dark-purple bob/lavender varsity; BROWN bun/ivory loose knit/dark baggy cargo; SILVER side ponytail/navy sailor/ivory skirt. Row1 FRONT, row2 RIGHT PROFILE, row3 BACK. Preserve exact original head shapes, eyes, hair locks and bows, clear chin-to-collar/neck separation, uncompressed original torso, sleeves, hands, hems, pockets and shoes. No creative redesign. Remove only text, frames, background, floor shadows and palette squares. Maintain crisp original detailed pixel art, no glow or gradient. Truly transparent background, alpha0.”

## 동작 확인

지정된 [minilongboard](https://minilongboard.vercel.app/)의 공개 기술 설명과 발 위치를 확인했다. 피봇과 피루엣의 지지점, 몸과 보드의 독립 회전을 유지하고 피터팬과 크로스스텝은 한 발씩 옮기도록 수정했다. 하드플립의 플립 방향을 해당 사이트 설명에 맞췄다. 사용자의 추가 동작표는 푸시·체중 이동·착지의 시각적 참고로 사용했다.
