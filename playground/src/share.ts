/**
 * Sharing.
 *
 * The document is compressed and put in the URL fragment. A fragment is never
 * sent to a server, so sharing a draft does not publish it — which matters when
 * the thing being shared is a provisional result.
 *
 * Compression uses the platform's CompressionStream, so this costs no
 * dependency.
 */

const PREFIX = '#doc=';

export async function encodeDocument(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const compressed = await collect(
    streamOf(bytes).pipeThrough(new CompressionStream('deflate-raw')),
  );
  return `${PREFIX}${toBase64Url(compressed)}`;
}

export async function decodeFragment(fragment: string): Promise<string | null> {
  if (!fragment.startsWith(PREFIX)) return null;

  try {
    const bytes = fromBase64Url(fragment.slice(PREFIX.length));
    const decompressed = await collect(
      streamOf(bytes).pipeThrough(new DecompressionStream('deflate-raw')),
    );
    return new TextDecoder().decode(decompressed);
  } catch {
    // A truncated or hand-edited link should leave the editor alone rather
    // than replacing what the reader was working on.
    return null;
  }
}

/**
 * A one-chunk stream. Avoids Blob, which not every runtime exposes fully.
 *
 * The cast bridges a variance mismatch between lib.dom's CompressionStream and
 * a plain Uint8Array; the bytes are identical at runtime.
 */
function streamOf(bytes: Uint8Array): ReadableStream<Uint8Array<ArrayBuffer>> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes as Uint8Array<ArrayBuffer>);
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array<ArrayBuffer>>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value !== undefined) chunks.push(value);
  }

  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
