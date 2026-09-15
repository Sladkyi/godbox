const clamp = (n, a = 0, b = 100) => Math.max(a, Math.min(b, n));

export function bumpTie(from, to, patch = {}) {
  if (!from || !to || from.id === to.id) return null;
  from.ties ??= [];
  let row = from.ties.find(t => t.id === to.id);
  if (!row) {
    if (from.ties.length >= 8) from.ties.sort((a, b) => (a.grudge + a.debt) - (b.grudge + b.debt)).shift();
    row = { id: to.id, debt: 0, grudge: 0, trust: 0, legend: '' };
    from.ties.push(row);
  }
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'legend' && value) row.legend = String(value).slice(0, 72);
    else if (key in row && key !== 'id' && key !== 'legend') row[key] = clamp((row[key] ?? 0) + value);
  }
  return row;
}

export function tieTrust(from, toId) {
  return from?.ties?.find(t => t.id === toId)?.trust ?? 0;
}

export function leaderName(world, village) {
  if (!village) return 'the elder';
  return world.units.find(u => u.id === village.leaderId)?.name ?? 'the elder';
}

export function compose(kind, f = {}) {
  const year = f.year ?? 1;
  const who = f.who ?? 'A traveller';
  const home = f.home ?? 'a quiet town';
  const there = f.there ?? 'a distant town';
  const town = f.town ?? home;
  const other = f.other ?? there;
  const leader = f.leader ?? 'the elder';
  const good = f.good ?? 'iron';
  switch (kind) {
    case 'world':
      return `Year ${year}. The land is quiet, and empty of names. What you do next will be remembered.`;
    case 'village':
      return `In year ${year} roofs rose at ${town}. A people chose a name, and the map gained a memory.`;
    case 'scout':
      return `In year ${year} ${who} of ${home} crossed the ridge and saw the lights of ${there}. ${who} came home with a story, and the two towns have watched each other ever since.`;
    case 'border':
      return `In year ${year} a stranger from ${other} was found on ${town} land. The guards named it, and the border grew a little hotter.`;
    case 'raid':
      return `In year ${year} ${who} slipped into ${there} and took food from the shared store. ${there} named it the debt of ${home}. The warehouses remember.`;
    case 'spy':
      return `In year ${year} ${who} of ${home} stole more than bread from ${there}: a map of ${f.secret}. That secret is already for sale.`;
    case 'war':
      return `In year ${year} the old patience of ${town} ran out. Heat with ${other} became open war. The elders say neither town will sleep until a debt is paid.`;
    case 'peace':
      return `In year ${year} ${town} and ${other} laid down the spears. The peace is uneasy. The debt is not forgotten.`;
    case 'siege':
      return `In year ${year} ${who} tore a building from ${there}. Stone remembers the blow, and so do the people who slept under it.`;
    case 'refuge':
      return `In year ${year} ${who} fled ${home} for ${there}. War made a refugee, and the road kept the name.`;
    case 'village-move':
      return `In year ${year} ${who} found a new home in ${there}. The old town became a story they tell at supper.`;
    case 'birth':
      return `A cry in ${town}: ${who} of the ${f.family ?? 'new'} family took a first breath under those roofs.`;
    case 'death':
      return f.count > 1
        ? `In year ${year} ${f.count} lives went quiet. The fields will feel the missing hands.`
        : `The house in ${town || 'the town'} went quiet. ${who} will not walk the fields again.`;
    case 'family':
      return `In year ${year} ${who} and ${f.partner} started a family in ${town}. A new house of names has begun.`;
    case 'build':
      return `${who} finished a building in ${town}. Another roof against the weather — and against forgetting.`;
    case 'cult':
      return `Rain fell on the dry fields of ${town}. ${leader} named you patron. A small cult of thanks has begun under those roofs.`;
    case 'wrath':
      return `In year ${year} the sky struck ${town}. ${f.detail ?? 'The people counted the dead.'} They fear the hand that did this.`;
    case 'trade':
      return `In year ${year} ${town} sent surplus food to ${other} for ${good}. The price was fair today. Trust grows in small carts.`;
    case 'ally':
      return `In year ${year} ${town} and ${other} named a common enemy in ${f.foe ?? 'the dark'}. Their patrols now walk as if they were kin.`;
    case 'gift':
      return `Stores appeared in ${town} when the town was weakest. The people say the world itself refused to let them vanish.`;
    case 'omen':
      return (
        {
          wolves: `The sheep of ${town} bunch together. Wolves are gathering in the dark wood. Something is coming.`,
          drought: `The harvest of ${town} is drying. ${leader} watches the sky and does not speak.`,
          meteor: `A new star hangs over ${town}. The night is too bright. The elders say the ground will remember.`,
          pray: `Hunger sits in ${town}. ${leader} looks at the sky and asks for a sign.`,
          gift: `The weaker streets of ${town} wait for a mercy the strong towns will not give.`,
          escalate: `The quiet between ${town} and ${other} is the wrong kind of quiet. Heat is coming back.`,
        }[f.omen] ?? `The air over ${town} has changed. Something is coming.`
      );
    case 'wolves':
      return `The howl reached ${town}. Wolves came out of the omen, and the night is no longer a story.`;
    case 'drought':
      return `The fields of ${town} cracked. What little grain there was became dust in the hand.`;
    case 'disaster':
      return f.town
        ? `In year ${year} disaster found ${town}. ${f.detail ?? 'The land changed shape.'}`
        : f.tool === 'meteor'
          ? `A meteor scarred the land. The crater will outlive the names around it.`
          : `Lightning split the sky. For a breath, the world had an edge.`;
    case 'life':
      return f.message ?? `${who} changed a life.`;
    default:
      return f.message ?? `In year ${year} the world took a breath.`;
  }
}
