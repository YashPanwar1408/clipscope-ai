import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  videoImportSchema,
  createWorkspaceSchema,
  loginSchema,
  registerSchema,
  chatMessageSchema,
} from "../lib/schemas/index.ts";

describe("Validation Schemas", () => {
  test("videoImportSchema validates valid YouTube Shorts link with uuid", () => {
    const valid = videoImportSchema.safeParse({
      url: "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      workspaceId: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    });
    assert.equal(valid.success, true);
  });

  test("videoImportSchema rejects invalid platform URL", () => {
    const invalid = videoImportSchema.safeParse({
      url: "https://vimeo.com/12345678",
      workspaceId: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    });
    assert.equal(invalid.success, false);
  });

  test("createWorkspaceSchema enforces name limits", () => {
    const short = createWorkspaceSchema.safeParse({ name: "A" });
    assert.equal(short.success, false);

    const valid = createWorkspaceSchema.safeParse({
      name: "Q4 Growth Competitors",
      description: "Comparing hooks against market leaders",
    });
    assert.equal(valid.success, true);
  });

  test("loginSchema validates email and minimum password length", () => {
    const invalidEmail = loginSchema.safeParse({
      email: "not-an-email",
      password: "password123",
    });
    assert.equal(invalidEmail.success, false);

    const valid = loginSchema.safeParse({
      email: "researcher@example.com",
      password: "securepassword123",
    });
    assert.equal(valid.success, true);
  });

  test("registerSchema enforces matching passwords", () => {
    const mismatched = registerSchema.safeParse({
      fullName: "Jane Doe",
      email: "jane@example.com",
      password: "password123",
      confirmPassword: "password456",
    });
    assert.equal(mismatched.success, false);

    const matched = registerSchema.safeParse({
      fullName: "Jane Doe",
      email: "jane@example.com",
      password: "password123",
      confirmPassword: "password123",
    });
    assert.equal(matched.success, true);
  });

  test("chatMessageSchema rejects empty messages", () => {
    const empty = chatMessageSchema.safeParse({
      message: "",
      sessionId: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    });
    assert.equal(empty.success, false);

    const valid = chatMessageSchema.safeParse({
      message: "What is the primary hook in video A?",
      sessionId: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    });
    assert.equal(valid.success, true);
  });
});
