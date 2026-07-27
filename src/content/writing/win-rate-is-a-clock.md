---
title: An item's win rate is mostly a clock
description: >-
  In Deadlock, an item's raw win rate correlates at r ≈ 0.91 with the win probability
  that already held when it was bought. Ranking by it mostly measures who was already
  ahead — here's what I did about it.
date: 2026-07-25
draft: true
---

Every build site for every game with a shop ranks items the same way: take every match
where someone bought the item, take the fraction that were won, sort descending. It is
the obvious statistic. It is also close to useless, and the reason is worth spelling
out because it generalizes well past video games.

## The measurement is downstream of the thing it's measuring

In Deadlock, items cost souls, and souls accumulate as you win fights. So the players
who buy a 6,000-soul item are, by construction, players who were doing well enough to
afford one. The item didn't cause that. The item is a *receipt* for it.

You can put a number on how bad this is. For each purchase, you can ask what the buyer's
win probability already was at the moment they bought — from net worth, objectives, and
time elapsed. Do that across a patch's worth of matches, then correlate each item's raw
win rate against the average pre-purchase win probability of the people who bought it.

On live data, that correlation is **r ≈ 0.91**.

Which is to say: if I tell you nothing about what an item does, and only tell you how
far ahead its typical buyer already was, I can predict its win rate almost perfectly. The
ranking is a leaderboard of purchase timing wearing a costume.

This is confounding in its purest form, and it shows up constantly outside games. Any
metric measured on a self-selected population inherits that population's traits. Users
who adopt your premium feature convert better — because they were already the users who
were going to convert. Patients who complete the treatment recover more — because
completion requires being well enough to complete it.

## Two fixes, and only one of them is the interesting one

The first is standard: don't compare raw win rates, compare win rates standardized on
the confounder. Deadlock's public API exposes an `adjusted_win_rate` that conditions on
net worth at time of purchase, which strips out most of the "who was already winning"
signal and leaves something closer to "what did this item do." That's a one-line change
once you know to make it, and it's most of the value.

The second fix is the one I found more interesting, because it isn't a statistics problem
at all.

**Ranking items and building a build are different operations.** Even with perfectly
unconfounded per-item scores, taking the top six does not give you a good build. Items
compete for the same souls, so a set of six is subject to a budget constraint the
individual scores know nothing about. Worse, items *interact*: two items may each score
well and be near-substitutes, so that owning both is barely better than owning one.
Independent scores cannot see either fact — a ranking has no notion of a set.

So Vibelock doesn't rank. It fills. Each phase of the game gets a real soul budget —
derived from what players of that hero and rank have actually spent by that point in the
match — and items are selected to fill it, balanced across weapon/vitality/spirit in the
proportions those players actually invest, and checked against measured co-purchase data
so that two items which are really an either/or don't both land in the same build.

The output is a set that satisfies a constraint, not a list sorted by a column.

## The general shape

Both halves of this reduce to the same discipline, and it's the one I keep returning to:

> The number that's easy to compute is rarely the number you care about. Before
> optimizing anything, work out what the easy number is *actually* measuring.

Raw win rate was measuring purchase timing. A top-six list was measuring six unrelated
questions instead of one joint one. Neither error is exotic; both are invisible if you
never ask.

The code is [on GitHub](https://github.com/pabulum/vibelock), and the app is
[live here](https://pabulum.github.io/vibelock/) — every row shows its win rate, pick
rate, and sample size, so you can disagree with the model and check its arithmetic.
