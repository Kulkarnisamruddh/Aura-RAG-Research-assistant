import { pipeline, env } from '@xenova/transformers';

// Skip local check for workers
env.allowLocalModels = false;

let extractor;

self.onmessage = async (e) => {
    const { type, text, chunks } = e.data;

    try {
        if (!extractor) {
            self.postMessage({ type: 'status', message: 'Loading AI model...' });
            extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
                quantized: true,
            });
        }

        if (type === 'embed_chunks') {
            const processedChunks = [];
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                self.postMessage({ type: 'progress', current: i + 1, total: chunks.length });
                
                const output = await extractor(chunk, { pooling: 'mean', normalize: true });
                processedChunks.push({
                    content: chunk,
                    embedding: Array.from(output.data)
                });
            }
            self.postMessage({ type: 'done', chunks: processedChunks });
        } else if (type === 'embed_query') {
            const output = await extractor(text, { pooling: 'mean', normalize: true });
            self.postMessage({ type: 'query_done', embedding: Array.from(output.data) });
        }
    } catch (err) {
        self.postMessage({ type: 'error', error: err.message });
    }
};
