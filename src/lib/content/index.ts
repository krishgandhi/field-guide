import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import {
  frontmatterSchema,
  type ContentType,
  type Frontmatter,
} from "./schema";

/**
 * The only module that touches the filesystem.
 *
 * MDX files in content/ are never routes themselves. This reads them off
 * disk, parses the YAML frontmatter once, validates it, and hands back the
 * body as a plain string for a server component to compile.
 *
 * Parsing frontmatter here and nowhere else keeps one source of truth: the
 * validated frontmatter and the body travel separately from this point on.
 */

const CONTENT_DIR = path.join(process.cwd(), "content");

export type Entry = {
  frontmatter: Frontmatter;
  /** MDX source with the frontmatter block already stripped off. */
  body: string;
};

function directoryFor(type: ContentType) {
  return path.join(CONTENT_DIR, type);
}

/** Turns a zod failure into something that names the file and the field. */
function describeInvalid(relativePath: string, error: unknown): string {
  const issues =
    error && typeof error === "object" && "issues" in error
      ? (error.issues as { path: PropertyKey[]; message: string }[])
      : [];

  const lines = issues.map((issue) => {
    const field = issue.path.join(".") || "(root)";
    return `  - ${field}: ${issue.message}`;
  });

  return `Invalid frontmatter in ${relativePath}\n${lines.join("\n")}`;
}

/**
 * Slugs for one content type, sorted. Feeds generateStaticParams.
 *
 * A missing directory returns [] rather than throwing — most of the six
 * content types have no files yet, and an index page shouldn't crash over it.
 */
export function getSlugs(type: ContentType): string[] {
  const dir = directoryFor(type);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => file.replace(/\.mdx$/, ""))
    .sort();
}

/**
 * One entry, validated. Returns null if the file doesn't exist so the caller
 * can render a 404; throws if the file exists but its frontmatter is wrong,
 * because that's a mistake in the content and should fail the build loudly.
 */
export function getEntry(type: ContentType, slug: string): Entry | null {
  const relativePath = path.join("content", type, `${slug}.mdx`);
  const absolutePath = path.join(directoryFor(type), `${slug}.mdx`);

  if (!fs.existsSync(absolutePath)) return null;

  const raw = fs.readFileSync(absolutePath, "utf8");
  const { data, content } = matter(raw);

  const parsed = frontmatterSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(describeInvalid(relativePath, parsed.error));
  }

  const frontmatter = parsed.data;

  // The frontmatter has to agree with where the file actually lives, or
  // links and lookups built from one will disagree with the other.
  if (frontmatter.slug !== slug) {
    throw new Error(
      `Slug mismatch in ${relativePath}: frontmatter says "${frontmatter.slug}" but the filename says "${slug}".`,
    );
  }
  if (frontmatter.type !== type) {
    throw new Error(
      `Type mismatch in ${relativePath}: frontmatter says "${frontmatter.type}" but the file is in content/${type}/.`,
    );
  }

  return { frontmatter, body: content };
}

/**
 * Frontmatter for every entry of one type — no bodies.
 *
 * This is what index pages and, shortly, the glossary term index (§6a) read.
 * It deliberately avoids compiling any MDX: building the term index must not
 * mean rendering fifty pages.
 */
export function getAllEntries(type: ContentType): Frontmatter[] {
  return getSlugs(type).map((slug) => {
    const entry = getEntry(type, slug);
    // getSlugs just listed it, so this only fires on a race we can't recover from.
    if (!entry) throw new Error(`Could not read content/${type}/${slug}.mdx`);
    return entry.frontmatter;
  });
}
