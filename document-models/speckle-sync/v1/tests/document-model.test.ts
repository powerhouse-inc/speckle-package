/**
 * This is a scaffold file meant for customization:
 * - change it by adding new tests or modifying the existing ones
 */
/**
 * This is a scaffold file meant for customization:
 * - change it by adding new tests or modifying the existing ones
 */

import {
  assertIsSpeckleSyncDocument,
  assertIsSpeckleSyncState,
  initialGlobalState,
  initialLocalState,
  isSpeckleSyncDocument,
  isSpeckleSyncState,
  speckleSyncDocumentType,
  utils,
} from "document-models/speckle-sync/v1";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

describe("SpeckleSync Document Model", () => {
  it("should create a new SpeckleSync document", () => {
    const document = utils.createDocument();

    expect(document).toBeDefined();
    expect(document.header.documentType).toBe(speckleSyncDocumentType);
  });

  it("should create a new SpeckleSync document with a valid initial state", () => {
    const document = utils.createDocument();
    expect(document.state.global).toStrictEqual(initialGlobalState);
    expect(document.state.local).toStrictEqual(initialLocalState);
    expect(isSpeckleSyncDocument(document)).toBe(true);
    expect(isSpeckleSyncState(document.state)).toBe(true);
  });
  it("should reject a document that is not a SpeckleSync document", () => {
    const wrongDocumentType = utils.createDocument();
    wrongDocumentType.header.documentType = "the-wrong-thing-1234";
    try {
      expect(assertIsSpeckleSyncDocument(wrongDocumentType)).toThrow();
      expect(isSpeckleSyncDocument(wrongDocumentType)).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError);
    }
  });
  const wrongState = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  wrongState.state.global = {
    ...{ notWhat: "you want" },
  };
  try {
    expect(isSpeckleSyncState(wrongState.state)).toBe(false);
    expect(assertIsSpeckleSyncState(wrongState.state)).toThrow();
    expect(isSpeckleSyncDocument(wrongState)).toBe(false);
    expect(assertIsSpeckleSyncDocument(wrongState)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const wrongInitialState = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  wrongInitialState.initialState.global = {
    ...{ notWhat: "you want" },
  };
  try {
    expect(isSpeckleSyncState(wrongInitialState.state)).toBe(false);
    expect(assertIsSpeckleSyncState(wrongInitialState.state)).toThrow();
    expect(isSpeckleSyncDocument(wrongInitialState)).toBe(false);
    expect(assertIsSpeckleSyncDocument(wrongInitialState)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingIdInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingIdInHeader.header.id;
  try {
    expect(isSpeckleSyncDocument(missingIdInHeader)).toBe(false);
    expect(assertIsSpeckleSyncDocument(missingIdInHeader)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingNameInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingNameInHeader.header.name;
  try {
    expect(isSpeckleSyncDocument(missingNameInHeader)).toBe(false);
    expect(assertIsSpeckleSyncDocument(missingNameInHeader)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingCreatedAtUtcIsoInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingCreatedAtUtcIsoInHeader.header.createdAtUtcIso;
  try {
    expect(isSpeckleSyncDocument(missingCreatedAtUtcIsoInHeader)).toBe(false);
    expect(
      assertIsSpeckleSyncDocument(missingCreatedAtUtcIsoInHeader),
    ).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingLastModifiedAtUtcIsoInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingLastModifiedAtUtcIsoInHeader.header.lastModifiedAtUtcIso;
  try {
    expect(isSpeckleSyncDocument(missingLastModifiedAtUtcIsoInHeader)).toBe(
      false,
    );
    expect(
      assertIsSpeckleSyncDocument(missingLastModifiedAtUtcIsoInHeader),
    ).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }
});
