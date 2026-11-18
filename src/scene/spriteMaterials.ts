// These guides are in the 192×224 atlas cells, before joint registration.
// Each hair contour follows the ends of the locks across the collar and
// shoulders. Short styles end at the collar row and need no extra guide.
type Contour = readonly (readonly [x: number, y: number])[];
const hairContours: Record<number, readonly (Contour | null)[]> = {
  6: [
    [[30,102],[60,102],[64,104],[72,104],[75,102],[121,102],[124,106],[135,106],[144,99],[160,99]],
    [[22,128],[46,130],[53,131],[58,122],[70,106],[87,101],[98,108],[117,108],[123,103],[170,103]],
    [[35,99],[58,105],[72,107],[84,112],[99,123],[109,123],[120,111],[129,108],[145,105],[165,98]],
    [[32,103],[76,103],[83,108],[104,105],[116,100],[126,114],[134,131],[141,131],[165,129]],
  ],
  7: [
    [[25,104],[52,103],[66,96],[72,92],[121,92],[129,98],[141,103],[166,104]],
    [[29,120],[61,121],[72,108],[82,98],[104,103],[117,109],[127,107],[166,97]],
    [[24,121],[54,120],[62,109],[70,94],[85,98],[114,98],[133,95],[141,110],[154,121],[174,121]],
    [[26,99],[55,100],[61,108],[79,107],[97,99],[120,98],[130,112],[139,121],[169,121]],
  ],
  8: [
    [[39,94],[50,104],[67,104],[78,101],[85,92],[113,92],[120,101],[140,104],[153,96]],
    [[26,140],[47,144],[65,148],[81,150],[92,134],[100,104],[118,101],[170,99]],
    [[24,122],[40,129],[59,137],[83,140],[102,146],[119,140],[137,138],[154,132],[168,122]],
    [[31,99],[70,101],[84,102],[94,107],[105,121],[113,149],[126,150],[145,142],[164,132],[179,124]],
  ],
  9: [
    [[25,103],[48,105],[63,109],[79,107],[85,101],[117,98],[130,107],[143,106],[159,102],[174,102]],
    [[19,123],[45,123],[54,142],[72,148],[84,144],[96,135],[100,117],[110,105],[123,116],[132,115],[155,103],[176,103]],
    [[16,143],[46,141],[63,144],[78,145],[95,142],[102,146],[111,146],[126,138],[143,139],[155,130],[175,130]],
    [[25,103],[59,103],[65,116],[78,115],[91,103],[101,114],[110,129],[127,145],[141,147],[157,143],[176,128]],
  ],
  10: [
    [[20,162],[43,163],[57,152],[65,129],[72,102],[121,99],[130,120],[139,154],[153,163],[176,156]],
    [[19,154],[51,158],[74,158],[88,144],[94,116],[105,102],[124,101],[165,99]],
    [[18,146],[43,153],[59,157],[83,163],[110,161],[132,156],[150,154],[175,148]],
    [[25,99],[64,101],[84,106],[102,123],[109,150],[129,160],[149,163],[176,150]],
  ],
  11: [
    [[21,110],[54,112],[63,105],[70,100],[119,100],[133,106],[147,112],[171,111]],
    [[28,111],[60,116],[74,109],[83,100],[110,103],[121,101],[162,100]],
    [[22,112],[53,113],[63,108],[71,98],[121,98],[135,108],[154,112],[175,109]],
    [[29,100],[76,100],[104,101],[114,111],[138,114],[173,111]],
  ],
  14: [
    [[29,99],[68,102],[124,99],[131,104],[141,116],[161,118],[177,113]],
    [[28,117],[60,117],[75,108],[87,99],[115,102],[126,99],[166,99]],
    [[16,117],[53,118],[64,111],[77,98],[124,98],[152,101],[176,101]],
    [[22,99],[66,99],[112,99],[124,108],[140,118],[158,117],[177,114]],
  ],
};

export function hairHem(model: number, direction: number, x: number, collar: number) {
  const contour = hairContours[model]?.[direction];
  if (!contour) return collar;
  if (x < contour[0][0]) return Math.max(collar, contour[0][1]);
  const [lastX, lastY] = contour[contour.length - 1];
  if (x > lastX) return Math.max(collar, lastY);
  for (let i = 1; i < contour.length; i++) {
    const [left, start] = contour[i - 1], [right, end] = contour[i];
    if (x < left || x > right) continue;
    return Math.max(collar, start + (end - start) * (x - left) / (right - left));
  }
  return collar;
}

export const MATERIAL = {
  fixed: 0, hair: 1, skin: 2, eyes: 3, shirt: 4, pants: 5, shoes: 6,
} as const;
export type Material = typeof MATERIAL[keyof typeof MATERIAL];
type Garment = typeof MATERIAL.hair | typeof MATERIAL.shirt | typeof MATERIAL.pants | typeof MATERIAL.shoes;

// The visible waistband can sit above the hip joint on an open jacket or a
// cropped top. Preserve the cloth ownership without moving the rig's cuts.
const frontWaist = [149,139,153,154,140,137,141,131,145,136,148,149,150,142,151];
const waistWidth = [18,14,25,23,16,17,19,18,25,11,14,14,17,24,14];
const exposedLegs: Record<number, readonly [number, number]> = {
  9: [176,188], 10: [180,190], 11: [167,181], 12: [167,182], 14: [167,182],
};

// Blonde and peach hair shadows share the same RGB range as the skin. Trace
// the visible skin inside their bangs, cheeks, ears and neckline in the atlas.
const frontSkin: Record<number, readonly Contour[]> = {
  1: [
    [[76,73],[81,66],[89,57],[90,76],[96,73],[102,66],[112,53],[119,64],[121,79],[127,76],[131,74],[131,82],[124,87],[117,87],[111,91],[101,95],[101,102],[92,103],[90,96],[82,94],[74,88],[67,87],[58,81],[60,75],[64,75],[73,82]],
  ],
  2: [
    [[74,73],[83,65],[89,59],[90,77],[99,71],[108,64],[112,53],[118,61],[122,76],[127,78],[132,75],[131,82],[123,86],[118,87],[109,93],[101,95],[101,105],[93,105],[91,95],[82,94],[73,89],[64,86],[59,79],[60,75],[66,76]],
  ],
  6: [
    [[68,77],[78,69],[85,63],[87,74],[96,69],[104,53],[108,56],[114,69],[120,75],[127,71],[128,78],[123,82],[118,82],[115,88],[104,93],[103,102],[91,101],[90,94],[83,91],[78,86],[74,81],[67,82],[63,78],[63,73],[67,72]],
  ],
  9: [
    [[75,66],[83,61],[89,56],[90,68],[97,65],[105,56],[111,48],[115,58],[121,63],[127,68],[133,68],[134,75],[129,80],[122,80],[118,84],[109,89],[104,91],[106,100],[93,101],[91,91],[84,89],[79,85],[73,82],[66,77],[65,71],[72,73]],
  ],
  10: [
    [[68,74],[72,63],[83,55],[88,52],[90,66],[99,68],[108,66],[113,53],[119,57],[128,65],[132,74],[127,85],[119,91],[102,95],[102,104],[91,103],[91,95],[76,89],[67,82],[59,76],[59,71],[65,72]],
  ],
  11: [
    [[65,73],[70,62],[79,52],[88,52],[90,65],[100,71],[108,69],[109,62],[117,52],[126,61],[130,73],[134,76],[132,84],[125,90],[105,98],[106,106],[92,105],[92,97],[78,94],[68,89],[64,83]],
  ],
};
const profileSkin: Record<number, readonly Contour[]> = {
  1: [
    [[111,82],[112,74],[115,68],[120,61],[124,55],[127,67],[128,77],[132,82],[133,88],[128,95],[120,98],[109,99],[108,104],[98,102],[98,93],[102,90],[99,85],[93,85],[87,83],[85,78],[91,73],[96,74],[101,82],[107,86]],
  ],
  2: [
    [[109,80],[113,73],[116,66],[120,59],[125,52],[128,63],[128,76],[133,81],[134,87],[129,94],[120,98],[106,99],[106,105],[100,103],[94,100],[94,94],[96,89],[92,85],[86,85],[82,81],[82,75],[87,71],[92,73],[97,80],[102,85],[107,86]],
  ],
  6: [
    [[119,72],[122,66],[130,59],[137,60],[139,65],[138,75],[144,79],[143,89],[139,95],[132,98],[124,99],[119,95],[119,86]],
    [[94,76],[99,72],[104,73],[108,77],[108,86],[101,89],[96,86],[93,82]],
  ],
  9: [
    [[115,76],[120,69],[127,62],[130,59],[133,65],[134,74],[136,80],[138,87],[137,92],[132,97],[123,101],[118,100],[116,95],[115,88]],
    [[91,79],[94,76],[99,76],[102,79],[104,86],[101,89],[95,88],[91,85]],
  ],
  10: [
    [[111,73],[116,61],[128,55],[135,58],[138,70],[142,83],[140,89],[132,93],[119,93],[114,88],[111,83]],
    [[88,72],[93,70],[96,76],[97,81],[101,84],[99,88],[92,84],[88,80]],
  ],
  11: [
    [[116,78],[118,70],[124,61],[135,57],[141,62],[140,73],[147,83],[145,90],[138,95],[123,98],[117,95],[116,88]],
    [[91,72],[96,69],[100,71],[101,79],[101,85],[96,85],[91,80]],
  ],
};
const leftSkin: Record<number, readonly Contour[]> = {
  6: [
    [[52,62],[62,61],[70,65],[73,74],[75,81],[75,91],[70,97],[60,97],[55,94],[52,88]],
    [[88,78],[94,75],[99,77],[100,83],[96,87],[88,87]],
  ],
  9: [
    [[53,62],[60,60],[68,64],[74,73],[76,82],[75,95],[69,98],[62,96],[56,92],[52,85]],
    [[86,78],[93,76],[98,78],[101,83],[99,89],[94,91],[86,88]],
  ],
};

function inContour(x: number, y: number, contour: Contour) {
  let inside = false;
  for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
    const [ax, ay] = contour[i], [bx, by] = contour[j];
    if ((ay > y) !== (by > y) && x < ax + (bx - ax) * (y - ay) / (by - ay)) inside = !inside;
  }
  return inside;
}

// First visible hand rows in the front, right, back and left artwork.
const handRows = [
  [139,147], [142,147], [142,146], [142,148], [141,147],
  [137,145], [142,150], [137,145], [138,151], [139,149],
  [146,148], [147,146], [144,145], [151,148], [145,146],
];
// The profile hand hangs in front of the trousers below the hip joint.
// Its own source bounds keep the pants from picking up a second hand.
const sideHands = [
  [[86,154,101,166],[90,154,105,166]], [[91,154,106,165],[85,154,100,165]],
  [[90,153,105,165],[86,153,101,165]], [[88,153,104,165],[87,153,103,165]],
  [[88,153,103,165],[88,153,103,165]], [[98,148,114,161],[80,151,94,161]],
  [[98,155,114,165],[78,156,93,164]], [[107,150,124,160],[69,150,85,161]],
  [[99,151,114,160],[76,150,93,161]], [[103,155,118,165],[73,155,89,165]],
  [[98,146,114,157],[77,146,93,157]], [[95,151,109,160],[82,151,96,160]],
  [[86,148,102,158],[89,148,105,158]], [[88,148,104,162],[87,148,103,162]],
  [[100,148,115,158],[76,148,91,158]],
];

export function profileHand(model: number, direction: number, x: number, y: number, margin = 0) {
  const [left, top, right, bottom] = sideHands[model][direction === 1 ? 0 : 1];
  if (y < top - margin || y > bottom + margin) return false;
  const inset = y >= bottom - 1 ? 2 : 0;
  return x >= left - margin + inset && x <= right + margin - inset;
}

function handZone(model: number, direction: number, x: number, y: number, center: number) {
  if (direction % 2 === 1) return profileHand(model,direction,x,y,1);
  const row = handRows[model][direction / 2];
  return y >= row && y < row + 16 && Math.abs(x - center) > 26;
}

export function spriteMaterial(
  model: number, direction: number, x: number, y: number, center: number,
  neck: number, eye: number, ankle: number, garment: Garment,
  r: number, g: number, b: number,
): Material {
  const front = direction === 0, rear = direction === 2, side = !front && !rear;
  const dx = x - center, distance = Math.abs(dx);
  const facing = dx * (direction === 1 ? 1 : -1);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const skin = r >= 137 && r - g >= 5 && r - g <= 99 && g - b >= 3 && g - b <= 51
    && r - b >= 14 && r - b <= 139;
  const collarSkin = y >= neck - 8 && y < neck + 6 && distance < (side ? 12 : 8);
  const faceWidth = y < eye - 3 ? 24 : y < neck - 14 ? 38 : y < neck - 8 ? 27 : 15;
  const face = y >= eye - 28 && y < neck - 3 && (front
    ? distance < faceWidth
    : side && facing >= (y < eye - 8 ? 9 : -8) && facing < 44);
  if (garment === MATERIAL.hair || y < neck + 6) {
    const faceGuide = front ? frontSkin[model] : direction === 3 && leftSkin[model] ? leftSkin[model] : side ? profileSkin[model] : undefined;
    const faceX = direction === 3 && !leftSkin[model] ? 191 - x : x;
    const inFace = faceGuide ? faceGuide.some(contour => inContour(faceX, y, contour)) : face || (!rear && collarSkin);
    const rearNeck = rear && (model === 7 || model === 12 || model === 13) && y >= neck && collarSkin;
    const rearEar = rear && model === 6 && y >= 75 && y < 85 && distance >= 31 && distance < 40;
    const eyeX = front ? distance > 7 && distance < 25 : side && facing > 16 && facing < 40;
    const eyeY = y >= eye - 4 && y <= eye + 10;
    const eyeWhite = eyeX && eyeY && min > 180 && r - b < 26;
    if (skin && (inFace || rearNeck || rearEar) && !eyeWhite) return MATERIAL.skin;
    if (garment === MATERIAL.hair) {
      if (eyeWhite) return MATERIAL.fixed;
      if (inFace && eyeX && eyeY && r < 140 && g < 113 && b < 146 && max > 61) return MATERIAL.eyes;
      if (y >= neck - 7 && distance < (side ? 13 : 23)) {
        const lightTrim = min > 155 && max - min < 47;
        if (lightTrim) return MATERIAL.fixed;
      }
      return MATERIAL.hair;
    }
  }

  const midriff = front && model === 6 && y >= 125 && y < 134 && distance < 18;
  const leg = exposedLegs[model];
  const legOffset = model === 9 && !front ? (rear ? 9 : 6) : 0;
  const bareLeg = leg && y >= leg[0] + legOffset && y < leg[1] + legOffset;
  if (skin && (handZone(model,direction,x,y,center) || midriff || bareLeg)) return MATERIAL.skin;

  if (max < 55) return MATERIAL.fixed;
  const atWaist = front && garment === MATERIAL.shirt && y >= frontWaist[model] && distance < waistWidth[model];
  const matchesPants = model === 7 || model === 9 ? r > g && r > b
    : model === 4 ? r > g || b > g : model === 0 || model === 5 ? r - g < 40 : true;
  if (atWaist && matchesPants) {
    return MATERIAL.pants;
  }
  // Socks, laces and pale accents remain authored details on their own layer.
  if (garment === MATERIAL.pants && y >= ankle - 8) return MATERIAL.fixed;
  if (min > 170 && max - min < 53 && !(model === 6 || model === 13)) return MATERIAL.fixed;
  return garment;
}
