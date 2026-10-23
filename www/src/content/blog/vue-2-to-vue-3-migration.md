---
title: Migrating a production app from Vue 2 to Vue 3
description: How a two-person team migrated a ten-year-old Laravel and Vue 2 app to Vue 3 with no test safety net, while feature work kept landing until we finally won a code freeze.
pubDate: 2026-10-23
tags: [Vue, Migrations]
caseStudy:
  order: 1
  highlights: [Vue 2 → Vue 3, Two-person team, Zero post-release issues]
---

## The context

The app in question is [Amiqus](https://amiqus.co), a platform businesses use to run identity verification and background checks. Those checks are carried out by real people, the data subjects, who complete them in the browser.

When I joined in February 2023, one of the first things I was told was that we had to be off Vue 2 by the end of 2024. Vue 2 was due to reach end of life on 31 December 2023, which meant that for the final year of the project we'd be running a production app on a framework that no longer received updates or security fixes. No pressure.

The app wasn't a greenfield project. It was roughly ten years old: a Laravel backend, Twig templates, and a bridge layer that mounted Vue 2 components inside those templates. Like any codebase that has been growing for a decade, it reflected the best tools and practices of each stage of its life, and plenty of it could be approached differently now that the ecosystem has moved on.

Going from Vue 2 to Vue 3 isn't a version bump. Vue 3 rethought a lot of the framework. The Composition API arrived as the new way of writing components, and although the Options API was still supported, plenty of the APIs around it changed or disappeared. The event bus is the obvious example: `$on`, `$off` and `$once` were removed entirely, and a lot of our components relied on them to talk to each other.

Then there was the part everyone warns you about. There were almost no unit tests. Lots of moving parts and very few guarantees. If we broke something, there was a good chance nothing would tell us until a user did. On a platform like Amiqus, that user might be someone who can't finish the background check they need for a new job or a house move. A bug there doesn't just cause a support ticket. It affects someone's life.

## Planning the migration

Before touching any code, we needed to know what we were dealing with.

### One rule: a 1:1 match

We set ourselves a clear goal from the start: the migrated app had to match the old one feature for feature. No new features, no "while we're in here" refactors. Every change existed only to reproduce the old behaviour on the new framework.

That rule did a lot of work for us. It kept scope contained, gave us a simple test for every decision ("does this behave exactly like it did before?"), and made code review easier. Where Vue 3 had removed something we depended on, we filled the gap as closely as we could rather than redesigning around it. For the event bus, that meant bringing in [tiny-emitter](https://github.com/scottcorgan/tiny-emitter), a small library that exposes the same `on` / `off` / `emit` interface, so existing components could keep working with minimal changes.

### A traffic light for every route

Next, we went through the breaking changes one by one and mapped them against the app. We listed every route and gave each one a rating:

- **Green**: low risk. Simple pages, few components, little or no use of deprecated APIs.
- **Amber**: medium risk. A handful of breaking changes to work through, but nothing we didn't understand.
- **Red**: high risk. Complex pages that leaned heavily on removed APIs, third-party Vue 2 plugins, or business logic that touched a lot of the app.

The traffic light system gave us a map of the whole job. We could see where the risk was concentrated, plan around it, and show the rest of the business what we were up against in a way that didn't need a Vue background to understand.

## The code freeze we didn't get (at first)

The ideal setup for a migration like this is a code freeze: stop feature work, migrate, ship, carry on. We asked for one. It wasn't possible. Other teams had their own roadmaps, and features kept shipping while we planned and migrated.

So we created a long-lived branch, `vue3-dev`, running in parallel with `main`. Two of us were now doing two jobs at once: porting the existing app to Vue 3, and porting every new feature that landed on `main` along the way. Every merge into `main` was something we had to bring across and often rewrite by hand.

To stop the two branches drifting apart, we made it a rule to merge `main` into `vue3-dev` every day before the end of the day. It was tedious, but small daily merges were far easier than letting a week of changes pile up, and it meant the migration was always working against something close to what was in production.

Even with the daily merges, the setup was far from ideal, and in hindsight I think it made the project much bigger than it needed to be. Early on, the full size of the effort was hard to see from outside the migration, and without a shared picture of it, a freeze or extra engineers were a hard sell against everything else on the roadmap. Every week without them made the parallel branch more expensive to maintain. But that wasn't the situation we were in, so we worked with what we had.

Eventually the cost caught up with us. As long as features kept landing on `main`, the finish line kept moving: every time we got close, there was another batch of changes to port. It became clear to everyone, not just the two of us, that the migration couldn't finish without some kind of freeze. This time we got buy-in from the other teams, feature work paused, and we were able to close it out.

## Doing the work

### Serving Vue 2 and Vue 3 side by side

The decision that made the biggest difference was not having to convert everything before anything worked. Because Laravel was already rendering every page, we could have it decide, route by route, which build to serve: the old Vue 2 bundle or the new Vue 3 one.

That meant `vue3-dev` was a working app at every stage of the migration, with some routes on Vue 3 and the rest still on Vue 2. We could migrate one route, check it, and move on, instead of building towards one huge switch at the end where everything had to work at once. If a migrated route had a problem, we could send it back to Vue 2 by changing which build Laravel served, without touching the rest of the migration.

On top of that, a feature flag controlled whether a client got *any* Vue 3 routes at all. Every merge into `vue3-dev` built the Vue 3 frontend and uploaded it to its own S3 bucket, alongside the Vue 2 assets from `main`. In production, Laravel checked the client's feature flags and served the matching assets, so flagged clients got the latest Vue 3 build long before `vue3-dev` was merged into `main`. We used the flag to limit the migrated routes to clients who had agreed to test the migration, so the first real-world use came from people who knew what they were testing and could tell us when something didn't look right. With almost no automated tests, that feedback did a lot of the work a test suite would normally do.

### Green to red

We worked through the traffic light in order, starting with green.

The first routes we migrated were the ones no customer or data subject ever sees: back-office and internal tooling, with fewer moving parts and a much smaller blast radius if something went wrong. They let us get comfortable with the new patterns, build up the shims we needed (like the event bus replacement), and find the problems that would come up everywhere, on pages where a mistake was cheap.

From there we moved up through amber and towards the shopfront, the part of Amiqus that data subjects use to complete their checks. That was where most of the red routes were, and where the stakes were highest: if a step in the shopfront broke, someone couldn't get verified. Leaving it until last meant that by the time we reached it, we'd already solved most of the recurring problems elsewhere and could give it our full attention.

### The form builder

The biggest single piece of work was the form builder. Amiqus has an interactive form builder that clients use to put together the forms data subjects fill in, and some of those forms are very long.

After the migration, the builder technically worked, but on long forms it performed badly. There wasn't one cause, but a few problems that added up:

- **`v-model` changes.** Vue 3 changed how `v-model` works on components, and the way our form fields passed values up and down no longer behaved the way it had in Vue 2. Combined with some debouncing that no longer did its job, updates fired far more often than they should have.
- **Store mutations in a loop.** Some updates ran one store mutation per field, in a loop. On a short form you'd never notice. On a form with hundreds of fields, that was hundreds of mutations, each triggering its own round of updates. We reworked these so the store was updated far fewer times.
- **Too many re-renders.** Some components rendered much more often than they needed to, so every change rippled through more of the page than it should have.

This was all still inside the 1:1 rule. The old builder handled long forms fine, so a migrated one that struggled wasn't a match, however correct its output was.

## Shipping with zero issues

We shipped on 2 February 2025, about a month past the end-of-2024 target. The slip came down to the same problem as above: as long as we were porting new features as well as the old app, we couldn't finish. Once the freeze was in place, the remaining work was finally a fixed size, and we could land it.

By the end, the project had grown well beyond the two of us. Getting it over the line meant working across teams, especially with the platform team on how and when to release, so that a change this big landed at the right moment and with the right support around it.

Before release, every page went through extensive manual QA, most of it done by the two of us. Without a test suite to lean on, that meant clicking through every route and comparing it against the Vue 2 version, again and again as `main` kept changing. By the time we were ready to merge, we were confident enough that the feature flag had done its job, and we removed it as part of the release.

On release day we merged `vue3-dev` into `main`, and the migrated app went out to every client at once. Nobody needed to be told about it, and that was the point: because we'd held ourselves to a 1:1 match from day one, there was no visual difference for clients or data subjects.

## What I'd do differently

The thing I'd change is how hard I argued for a code freeze at the start.

Looking back at where the time went, the numbers make the case better than I did at the time. The actual syntax migration, converting the code to work on Vue 3, took a couple of months. Testing, QA and getting it released took a bit over a year. Most of that year wasn't spent on the hard parts of Vue 3. It went on keeping a moving target working: porting every new feature to the branch, re-testing pages that had changed underneath us, and starting the QA again each time.

We got a freeze in the end anyway, because the project couldn't finish without one. If I'd gone in with a clearer picture of that cost and asked for the freeze and extra hands up front, I think the same migration could have shipped months earlier.

## What I'd do again

Plenty of it worked, and there are three things I'd do the same way next time:

- **Planning before writing any code.** Going through every breaking change and mapping it against the app before touching anything meant we knew where the risk was before we started, and the code changes themselves went quickly because of it.
- **The traffic light.** Rating every route by risk told us where to start and where to be careful, and it made the size of the job easy to explain to people outside engineering.
- **Delivering routes behind the feature flag.** Serving Vue 3 routes only to pilot clients meant migrated pages were used in production long before release, and we were never betting everything on one big switch.

## Looking back

For me personally, this project was an incredible learning experience, and it came at a great time. I had only just joined the company, and migrating every route meant seeing every part of the app: how it fit together, why it worked the way it did, and where the tricky bits were. That kind of context usually builds up slowly, one feature at a time. I got it all through a single project.

That context has stayed with me. I know every part of our front end today, and this migration is the main reason why.
