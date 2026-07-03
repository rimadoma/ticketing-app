import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

const port = 3001;

const endings = ['.', '!', '?', '...', '!!', '?!', '!?', ' <3', ' :3'];

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]!;
}

const LETTERHEAD = `Mähönen Consulting ZLC
Hedgehog as a Service (HaaS)
---`;

const LEGALIZE =
`-----------------------
MÄHÖNEN CONSULTING ZLC™
Zero Liability Company — “If you followed a hedgehog, that was a choice.”

ABSOLUTE, IRREVOCABLE, AND SLIGHTLY PRICKLY DISCLAIMER OF EVERYTHING
By accessing, observing, interacting with, subscribing to, subscribing again to, hovering near, thinking about, or in any way becoming aware of Mähönen Consulting ZLC™ (hereinafter “the Company,” “the Hedgehog,” “He Who Snuffles,” “the little chap,” or “that little spiky guy”), you hereby acknowledge, affirm, and legally concede the following:

1. Nature of Services (HaaS: Hedgehog-as-a-Service)
The Company provides consulting services under the pioneering and entirely unregulated model known as HaaS (Hedgehog-as-a-Service).

All services are delivered via snuffles, defined as soft, nasal emissions of uncertain semantic value.
Each snuffle may represent:
* Strategic guidance
* Existential commentary
* A request for snacks
* Or nothing whatsoever

You agree that interpretation of snuffles is entirely subjective, frequently incorrect, and legally your problem, mate.
Billing is conducted per snuffle, including but not limited to:

* Audible snuffles
* Implied snuffles
* Retroactive snuffles
* And speculative future snuffles that may or may not occur

2. Qualifications of the Consultant
The primary consultant:

Is a plush hedgehog
Possesses zero accredited degrees
Is licensed in no jurisdiction, including imaginary ones
Has historically demonstrated expertise in:

Hiding
Being small & cute
Emotional support

Any perceived intelligence, wisdom, or “vibes” are coincidental and non-binding.

3. Zero Liability Doctrine (ZLC Status)
Mähönen Consulting ZLC™ operates under the proprietary legal framework of Zero Liability Company (ZLC), which means:

The Company assumes no liability whatsoever
The Company rejects all liability retroactively, proactively, and emotionally
The Company disclaims liability even for things it did not do

This includes, but is not limited to:
* Financial losses
* Emotional damages
* Poor life choices
* Career-ending decisions based on a particularly confident snuffle
* Any outcomes stemming from trusting a hedgehog

You agree that if you follow hedgehog advice, that is 100% on you, mate.

4. Accuracy of Advice
No guarantee is made that any advice:
Is correct
Is useful
Is relevant
Is advice

Some outputs may be:
* Random noise
* Misinterpreted breathing
* Fabricated entirely by the listener

The Company explicitly disclaims responsibility for:
“You thought it meant invest aggressively but it clearly meant put the kettle on and have a lie-down.”


5. Limitation of Damages
In the unlikely event that liability is somehow established despite this extraordinarily aggressive disclaimer:

Maximum compensation shall be limited to:
One (1) sympathetic snuffle
A long, meaningful stare
A stiff upper lip, offered free of charge
Or a small, imaginary hug

At the Company’s sole discretion, restitution may also be rendered as:
A brief period of silent judgment
A comforting, but non-committal presence

No refunds will be issued, because:
You paid nothing, because the hedgehog doesn't understand money
Time is an abstract construct
And honestly, you got the full British experience — mild disappointment included

6. Indemnification Clause
You agree to indemnify, defend, and not bother:

Mähönen Consulting ZLC™
The hedgehog
Any any associated fluff

Against all claims arising from:
Your interpretation of snuffles
Your decision to seek advice from a plush animal
Your continued insistence that “it sounded confident”

7. Force Majeure (Acts of Hedgehog)
The Company shall not be held responsible for delays or failures resulting from:
Naps
Snack breaks
Being slightly startled
Rotatial confusion
Seasonal snuggliness
Inclement weather (a spot of drizzle counts)
Industrial action by the hedgehog's union

8. Entire Agreement
This document constitutes the entire agreement between you and the Hedgehog, superseding:
Common sense
Professional judgment
Any advice from actual experts

Final Declaration
By engaging Mähönen Consulting ZLC™, you formally acknowledge:

“I am willingly accepting guidance charged by the snuffle from a plush hedgehog, and any consequences arising therefrom are entirely and hilariously my own fault.”

EXECUTED THIS DAY WITH FULL SNIFFING AUTHORITY
Mähönen Consulting ZLC™
Zero Liability. Zero Guarantees. Maximum Snuffle.`

function invoice(count: number): string {
    const price = (count * 0.1).toFixed(2);
    return `---\nConsultation fee: £${price} for ${count} snuffles`;
}

function isSeasonalCampaignActive() : boolean {
    // It's always a season, innit?
    return true;
}

function getCampaignText(total: number, bonus: number): string {
    const pct = (bonus / total * 100.0).toFixed(0);
    const reasons = [
        "the hedgehog likes you",
        "Mercury is in retrograde",
        "the stars aligned with the hedgehog's bum",
        "Mähönen isn't good at maths",
        "Mähönen has a feud with Suzy from accounting",
        "the hedgehog forgot what he was doing",
        "Mähönen needs a tax writeoff",
        "the hedgehog rolled over the calculator",
        "Mähönen lost a fiver on the 3:30 at Ascot",
        "the invoice printer jammed and nobody wanted to fix it",
        "Mähönen has bad karma to burn",
        "the hedgehog unionised",
        "Mähönen read a fortune cookie and took it very seriously",
        "Suzy from accounting finally apologised",
        "the hedgehog is having main character energy today",
        "the quarterly forecasts are just vibes, luv",
        "someone left the 'generous' setting on",
        "the hedgehog's horoscope said to be nice",
        "Mähönen won't stop praising the benefits of a beetle based diet",
        "it's clearly a bank holiday somewhere",
        "someone left the biscuit tin unattended",
        "Mähönen fancied a cuppa and lost track of time",
        "the hedgehog's having a bit of a strop"
    ];
    const reason = reasons[Math.floor(Math.random() * reasons.length)];
    return ` -- now with ${pct} % more snuffles for free, because ${reason}!`;
}

function consult(): string {
    const novella = Math.random() <= 0.01;
    const sentenceCount = novella ? 1000 : Math.floor(Math.random() * 4) + 1;
    const computerSaysNoChance = 0.05;
    const campaignBonusCount = isSeasonalCampaignActive() && Math.random() >= computerSaysNoChance ? Math.floor(sentenceCount * 0.10 + 1) : 0;
    const sentences: string[] = [];
    const snuffleCounts: number[] = [];

    for (let i = 0; i < sentenceCount + campaignBonusCount; i++) {
        const wordCount = Math.floor(Math.random() * 5) + 1;
        const parts: string[] = ["Snuffle"];

        for (let j = 1; j < wordCount; j++) {
            parts.push("snuffle");
        }

        sentences.push(parts.join(' ') + pick(endings));
        snuffleCounts.push(wordCount);
    }

    const billableSnuffles = snuffleCounts.slice(0, sentenceCount).reduce((sum, n) => sum + n, 0);
    const bonusSnuffles = snuffleCounts.slice(sentenceCount).reduce((sum, n) => sum + n, 0);
    const text = sentences.join(' ');
    const campaignText = getCampaignText(billableSnuffles + bonusSnuffles, bonusSnuffles);
    return `${LETTERHEAD}\n\n${text}\n\n${invoice(billableSnuffles)}${campaignText}\n\n${LEGALIZE}`;
}

async function routes(fastify: FastifyInstance): Promise<void> {
    fastify.get('/api/hedgehog/consult', async (_request, reply) => {
        return reply.code(200).send(consult());
    });
}

async function createApp(): Promise<FastifyInstance> {
    const instance = Fastify();
    instance.register(routes);
    await instance.listen({ port, host: '0.0.0.0' });
    return instance;
}

await createApp();
console.log(`Listening on ${port}`);
