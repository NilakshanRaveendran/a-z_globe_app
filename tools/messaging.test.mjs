import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = stripTypeScriptTypes(
  await readFile(
    new URL("../apps/azglobe/src/modules/messaging/model.ts", import.meta.url),
    "utf8",
  ),
);
const {
  seedState,
  createGroup,
  joinGroup,
  memberOf,
  canSend,
  canManage,
  canEditInfo,
  vote,
  reactTo,
  fileKind,
  fileBadge,
  mimeFor,
  formatBytes,
  isVisual,
  preview,
} = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);
const member = { id: "test-member", name: "Test Member", provider: false };
const provider = { id: "test-provider", name: "Test Provider", provider: true };
const input = {
  name: "Local events",
  description: "Plan local events",
  category: "Events",
  image: "",
  permissions: {
    posting: "everyone",
    editing: "admins",
    joining: "anyone",
    polls: true,
    events: true,
  },
};

test("only providers create groups and only the owner can manage protected settings", () => {
  assert.throws(() => createGroup(member, input), /Only service providers/);
  const group = createGroup(provider, input);
  assert.ok(canManage(group, provider));
  assert.ok(!canManage(group, { ...provider, id: "other-provider" }));
  assert.ok(!canManage(group, member));
  assert.ok(memberOf(group, provider));
  assert.throws(
    () => createGroup(provider, { ...input, name: " " }),
    /Complete/,
  );
});

test("join is idempotent and approval does not grant membership or posting", () => {
  const original = createGroup(provider, input);
  const joined = joinGroup(original, member);
  assert.equal(joined.count, 2);
  assert.equal(joinGroup(joined, member).count, 2);
  assert.ok(canSend(joined, member));
  const restricted = {
    ...original,
    permissions: { ...original.permissions, joining: "approval" },
  };
  const requested = joinGroup(restricted, member);
  assert.equal(requested.requests.length, 1);
  assert.equal(joinGroup(requested, member).requests.length, 1);
  assert.ok(!memberOf(requested, member));
  assert.ok(!canSend(requested, member));
});

test("posting, info editing, poll and event permissions are enforced independently", () => {
  const group = joinGroup(createGroup(provider, input), member);
  assert.ok(!canEditInfo(group, member));
  const restricted = {
    ...group,
    permissions: {
      ...group.permissions,
      posting: "admins",
      editing: "everyone",
    },
  };
  assert.ok(!canSend(restricted, member));
  assert.ok(canSend(restricted, provider));
  assert.ok(canEditInfo(restricted, member));
  assert.ok(!canManage(restricted, member));
  const noExtras = {
    ...group,
    permissions: { ...group.permissions, polls: false, events: false },
  };
  assert.ok(canSend(noExtras, member, "text"));
  assert.ok(!canSend(noExtras, member, "poll"));
  assert.ok(!canSend(noExtras, member, "event"));
  assert.ok(canSend(noExtras, provider, "event"));
});

test("single and multiple polls can be voted, changed and unvoted without duplicate votes", () => {
  const message = {
    poll: { options: ["Saturday", "Sunday"], multiple: false, votes: {} },
  };
  const saturday = vote(message, member, 0);
  assert.deepEqual(saturday.poll.votes[member.id], [0]);
  const sunday = vote(saturday, member, 1);
  assert.deepEqual(sunday.poll.votes[member.id], [1]);
  assert.deepEqual(vote(sunday, member, 1).poll.votes[member.id], []);
  assert.deepEqual(
    vote({ ...saturday, poll: { ...saturday.poll, multiple: true } }, member, 1)
      .poll.votes[member.id],
    [0, 1],
  );
  assert.equal(vote(message, member, 9), message);
});

test("one reaction per person can be changed or removed without affecting others", () => {
  const message = { reactions: { "👍": ["another-user"] } };
  const first = reactTo(message, member, "👍");
  assert.equal(first.reactions["👍"].length, 2);
  const changed = reactTo(first, member, "❤️");
  assert.deepEqual(changed.reactions["👍"], ["another-user"]);
  assert.deepEqual(changed.reactions["❤️"], [member.id]);
  assert.equal(reactTo(changed, member, "❤️").reactions["❤️"], undefined);
});

test("sample content includes joined/discoverable/approval/admin-only groups and referenced replies", () => {
  const state = seedState(member);
  assert.ok(state.groups.some((g) => memberOf(g, member)));
  assert.ok(state.groups.some((g) => !memberOf(g, member)));
  assert.ok(state.groups.some((g) => g.permissions.joining === "approval"));
  assert.ok(state.groups.some((g) => g.permissions.posting === "admins"));
  for (const m of state.messages.filter((m) => m.replyTo))
    assert.ok(state.messages.some((original) => original.id === m.replyTo));
});

test("every kind of file is recognised, even when the browser gives no MIME type", () => {
  const kind = (name, mime = "") => fileKind({ name, mime });
  assert.equal(kind("Menu.pdf"), "pdf");
  assert.equal(kind("photo.HEIC"), "image");
  assert.equal(kind("clip.mov"), "video");
  assert.equal(kind("song.mp3"), "audio");
  assert.equal(kind("voice.m4a", "audio/mp4"), "audio");
  assert.equal(kind("Plan.docx"), "document");
  assert.equal(kind("Budget.xlsx"), "spreadsheet");
  assert.equal(kind("prices.csv", "text/csv"), "spreadsheet");
  assert.equal(kind("Deck.pptx"), "presentation");
  assert.equal(kind("photos.zip"), "archive");
  assert.equal(kind("book.epub"), "document");
  assert.equal(kind("notes.md"), "text");
  assert.equal(kind("script.py", "application/octet-stream"), "text");
  assert.equal(kind("mystery.bin"), "other");
  assert.equal(kind("no-extension"), "other");
  assert.equal(mimeFor("song.mp3", ""), "audio/mpeg");
  assert.equal(mimeFor("clip.webm", "video/webm;codecs=vp9"), "video/webm");
  assert.equal(fileBadge({ name: "Plan.docx" }), "DOCX");
  assert.equal(fileBadge({ name: "archive.tar.gz" }), "GZ");
  assert.equal(fileBadge({ name: "noext", mime: "application/pdf" }), "PDF");
  assert.ok(isVisual({ name: "a.png" }) && isVisual({ name: "b.mp4" }));
  assert.ok(!isVisual({ name: "c.pdf" }));
});

test("file sizes read naturally", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(812), "812 B");
  assert.equal(formatBytes(1536), "1.5 KB");
  assert.equal(formatBytes(3.4 * 1024 * 1024), "3.4 MB");
  assert.equal(formatBytes(250 * 1024 * 1024), "250 MB");
});

test("previews name what was sent, in any script", () => {
  const msg = (attachments, over = {}) => ({ kind: "document", text: "", attachments, ...over });
  const f = (name, size = 1) => ({ id: name, name, mime: "", size });
  assert.equal(preview(msg([f("a.jpg")], { kind: "media" })), "📷 Photo");
  assert.equal(preview(msg([f("a.jpg"), f("b.png")], { kind: "media" })), "📷 2 photos");
  assert.equal(preview(msg([f("a.jpg"), f("b.mp4")], { kind: "media" })), "🖼️ 2 photos & videos");
  assert.equal(preview(msg([f("மெனு.pdf")])), "📄 மெனு.pdf");
  assert.equal(preview(msg([f("බයිලා.mp3")])), "🎵 බයිලා.mp3");
  assert.equal(preview(msg([f("a.pdf"), f("b.docx")])), "📎 2 files");
  assert.equal(preview(msg([], { text: "வணக்கம் 👋🏽" })), "வணக்கம் 👋🏽");
  assert.equal(preview({ kind: "voice", text: "", attachments: [] }), "🎤 Voice message");
});

test("initials never split an emoji or a letter from its vowel sign", async () => {
  const src = stripTypeScriptTypes(
    await readFile(new URL("../packages/core/src/utils/text.ts", import.meta.url), "utf8"),
  );
  const { initials, firstGrapheme, truncate, visibleLength } = await import(
    `data:text/javascript;base64,${Buffer.from(src).toString("base64")}`
  );
  assert.equal(initials("Priya Selvaraj"), "PS");
  assert.equal(initials("🍛 Food Lovers"), "🍛F");
  assert.equal(initials("👩🏽‍🍳 Chef"), "👩🏽‍🍳C");
  assert.equal(initials("தமிழ் செல்வி"), "தசெ");
  // A consonant keeps its vowel sign ("සු", "පෙ"), never a bare base letter.
  assert.equal(initials("සුනිල් පෙරේරා"), "සුපෙ");
  assert.equal(initials("   "), "?");
  assert.equal(firstGrapheme("🇱🇰 Sri Lanka"), "🇱🇰");
  assert.equal(visibleLength("வணக்கம்"), 5); // வ ண க் க ம்
  assert.equal(truncate("👋🏽👋🏽👋🏽", 2), "👋🏽…");
});
