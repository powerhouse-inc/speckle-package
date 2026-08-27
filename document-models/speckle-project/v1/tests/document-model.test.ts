/**
 * This is a scaffold file meant for customization:
 * - change it by adding new tests or modifying the existing ones
 */
/**
 * This is a scaffold file meant for customization:
 * - change it by adding new tests or modifying the existing ones
 */

import {
  assertIsSpeckleProjectDocument,
  assertIsSpeckleProjectState,
  initialGlobalState,
  initialLocalState,
  isSpeckleProjectDocument,
  isSpeckleProjectState,
  speckleProjectDocumentType,
  utils,
} from "document-models/speckle-project/v1";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

describe("SpeckleProject Document Model", () => {
  it("should create a new SpeckleProject document", () => {
    const document = utils.createDocument();

    expect(document).toBeDefined();
    expect(document.header.documentType).toBe(speckleProjectDocumentType);
  });

  it("should create a new SpeckleProject document with a valid initial state", () => {
    const document = utils.createDocument();
    expect(document.state.global).toStrictEqual(initialGlobalState);
    expect(document.state.local).toStrictEqual(initialLocalState);
    expect(isSpeckleProjectDocument(document)).toBe(true);
    expect(isSpeckleProjectState(document.state)).toBe(true);
  });
  it("should reject a document that is not a SpeckleProject document", () => {
    const wrongDocumentType = utils.createDocument();
    wrongDocumentType.header.documentType = "the-wrong-thing-1234";
    try {
      expect(assertIsSpeckleProjectDocument(wrongDocumentType)).toThrow();
      expect(isSpeckleProjectDocument(wrongDocumentType)).toBe(false);
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
    expect(isSpeckleProjectState(wrongState.state)).toBe(false);
    expect(assertIsSpeckleProjectState(wrongState.state)).toThrow();
    expect(isSpeckleProjectDocument(wrongState)).toBe(false);
    expect(assertIsSpeckleProjectDocument(wrongState)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const wrongInitialState = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  wrongInitialState.initialState.global = {
    ...{ notWhat: "you want" },
  };
  try {
    expect(isSpeckleProjectState(wrongInitialState.state)).toBe(false);
    expect(assertIsSpeckleProjectState(wrongInitialState.state)).toThrow();
    expect(isSpeckleProjectDocument(wrongInitialState)).toBe(false);
    expect(assertIsSpeckleProjectDocument(wrongInitialState)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingIdInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingIdInHeader.header.id;
  try {
    expect(isSpeckleProjectDocument(missingIdInHeader)).toBe(false);
    expect(assertIsSpeckleProjectDocument(missingIdInHeader)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingNameInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingNameInHeader.header.name;
  try {
    expect(isSpeckleProjectDocument(missingNameInHeader)).toBe(false);
    expect(assertIsSpeckleProjectDocument(missingNameInHeader)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingCreatedAtUtcIsoInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingCreatedAtUtcIsoInHeader.header.createdAtUtcIso;
  try {
    expect(isSpeckleProjectDocument(missingCreatedAtUtcIsoInHeader)).toBe(
      false,
    );
    expect(
      assertIsSpeckleProjectDocument(missingCreatedAtUtcIsoInHeader),
    ).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingLastModifiedAtUtcIsoInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingLastModifiedAtUtcIsoInHeader.header.lastModifiedAtUtcIso;
  try {
    expect(isSpeckleProjectDocument(missingLastModifiedAtUtcIsoInHeader)).toBe(
      false,
    );
    expect(
      assertIsSpeckleProjectDocument(missingLastModifiedAtUtcIsoInHeader),
    ).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }
});
