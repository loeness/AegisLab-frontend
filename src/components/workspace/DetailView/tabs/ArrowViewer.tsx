import { useCallback, useEffect, useRef, useState } from 'react';

import perspective from '@finos/perspective';
import perspective_viewer from '@finos/perspective-viewer';
import '@finos/perspective-viewer-datagrid';
import '@finos/perspective-viewer/dist/css/pro.css';
import CLIENT_WASM from '@finos/perspective-viewer/dist/wasm/perspective-viewer.wasm?url';
import SERVER_WASM from '@finos/perspective/dist/wasm/perspective-server.wasm?url';
import { Progress } from 'antd';
import {
  compressionRegistry,
  CompressionType,
  RecordBatchReader,
  Table,
  tableToIPC,
} from 'apache-arrow';
import { decompress } from 'fzstd';

import { injectionApi } from '@/api/injections';

import './ArrowViewer.css';

compressionRegistry.set(CompressionType.ZSTD, {
  decode: (data: Uint8Array) => {
    const decoded = decompress(data);
    if (decoded.byteOffset % 8 !== 0) {
      return new Uint8Array(decoded);
    }
    return decoded;
  },
});

interface PerspectiveViewerElement extends HTMLElement {
  load: (table: unknown) => Promise<void>;
  reset: () => Promise<void>;
  restore: (config: {
    settings?: boolean;
    editable?: boolean;
  }) => Promise<void>;
  delete: () => Promise<void>;
}

let _initPromise: Promise<void> | null = null;

function ensureInit(): Promise<void> {
  if (!_initPromise) {
    _initPromise = Promise.all([
      perspective.init_server(fetch(SERVER_WASM)),
      customElements.get('perspective-viewer')
        ? Promise.resolve()
        : perspective_viewer.init_client(fetch(CLIENT_WASM)),
    ]).then(() => {
      // WASM initialized
    });
  }
  return _initPromise;
}

/**
 * Global shared Worker (can only be created after init completes)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _workerPromise: Promise<any> | null = null;

function getWorker() {
  if (!_workerPromise) {
    _workerPromise = ensureInit().then(() => perspective.worker());
  }
  return _workerPromise;
}

interface ArrowViewerProps {
  /** Injection ID for fetching data */
  injectionId: number;
  /** File path within the datapack */
  filePath: string;
  height?: string;
}

const ArrowViewer: React.FC<ArrowViewerProps> = ({
  injectionId,
  filePath,
  height = '70vh',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<PerspectiveViewerElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tableRef = useRef<any>(null);
  /** Prevent duplicate requests: record the key of the currently loading data */
  const loadingKeyRef = useRef<string | null>(null);
  /** AbortController for cancelling in-flight fetch requests */
  const abortControllerRef = useRef<AbortController | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Progress percentage (0-100) */
  const [progress, setProgress] = useState(0);
  /** Description of the current stage */
  const [progressTip, setProgressTip] = useState('Downloading...');

  const cleanup = useCallback(async () => {
    try {
      if (viewerRef.current && tableRef.current) {
        await viewerRef.current.reset();
      }
      if (tableRef.current) {
        await tableRef.current.delete();
        tableRef.current = null;
      }
    } catch {
      // Silently ignore cleanup errors
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!viewerRef.current) {
      const viewer = document.createElement(
        'perspective-viewer'
      ) as PerspectiveViewerElement;
      viewer.classList.add('arrow-perspective-viewer');
      viewer.setAttribute('theme', 'Pro Light');
      containerRef.current.appendChild(viewer);
      viewerRef.current = viewer;
    }

    if (!injectionId || !filePath) {
      setError('No data provided');
      setLoading(false);
      return;
    }

    // Use injectionId + filePath as unique identifier to prevent duplicate requests
    const loadKey = `${injectionId}:${filePath}`;
    if (loadingKeyRef.current === loadKey) {
      return;
    }
    loadingKeyRef.current = loadKey;

    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      setProgress(0);
      setProgressTip('Downloading...');

      try {
        // Cancel previous request
        abortControllerRef.current?.abort();
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        const response = await injectionApi.queryDatapackFileContent(
          injectionId,
          filePath
        );
        if (cancelled) return;

        const axiosResponse = response as unknown as {
          headers: { get(name: string): string | null };
          body: ReadableStream;
        };
        const totalRows = parseInt(
          axiosResponse.headers.get('X-Total-Rows') || '0'
        );

        const body = axiosResponse.body;
        if (!body) throw new Error('Response body is null');

        const worker = await getWorker();
        if (cancelled) return;
        await cleanup();

        const pos = 80;

        let receivedRows = 0;

        const reader = await RecordBatchReader.from(axiosResponse.body);
        for await (const batch of reader) {
          if (cancelled) break;

          receivedRows += batch.numRows;

          if (totalRows > 0) {
            const pct = Math.round((receivedRows / totalRows) * pos);
            setProgress(pct);
            setProgressTip(`Loading: ${receivedRows} / ${totalRows} rows`);
          }

          const chunkBinary = tableToIPC(new Table([batch]));
          if (!tableRef.current) {
            tableRef.current = await worker.table(chunkBinary.buffer);
          } else {
            await tableRef.current.update(chunkBinary.buffer);
          }
        }

        if (receivedRows === 0) {
          throw new Error(
            'Received empty data. The file may be empty or the server returned no data.'
          );
        }

        setProgress(pos);
        setProgressTip('Generating UI components...');
        const viewer = viewerRef.current;
        if (viewer) {
          await viewer.load(tableRef.current);
          await viewer.restore({ settings: true, editable: false });
        }

        setProgress(100);
        setProgressTip('Finished');
      } catch (e) {
        // AbortError is a normal cancellation, no error reporting
        if (e instanceof DOMException && e.name === 'AbortError') {
          return;
        }
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error('[ArrowViewer] Error:', msg);
          setError(msg);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
      loadingKeyRef.current = null;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      cleanup();
    };
  }, [injectionId, filePath, cleanup]);

  useEffect(() => {
    const container = containerRef.current;
    const viewer = viewerRef.current;

    return () => {
      if (viewer && container) {
        try {
          container.removeChild(viewer);
        } catch {
          // Node may have already been removed
        }
        viewerRef.current = null;
      }
    };
  }, []);

  return (
    <div className='arrow-viewer-container' style={{ height, width: '100%' }}>
      {/* Circular progress overlay */}
      {loading && (
        <div className='arrow-viewer-progress-overlay'>
          <Progress
            type='circle'
            percent={progress}
            size={100}
            strokeColor={{
              '0%': 'var(--color-primary-500)',
              '100%': 'var(--color-success)',
            }}
          />
          <span className='progress-tip'>{progressTip}</span>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className='arrow-viewer-error'>
          <span className='error-icon'>⚠️</span>
          <span className='error-title'>Failed to load Arrow data</span>
          <span className='error-message'>{error}</span>
          <span className='error-hint'>
            Please check the data format or try again later.
          </span>
        </div>
      )}

      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          display: error && !loading ? 'none' : 'block',
        }}
      />
    </div>
  );
};

export default ArrowViewer;
