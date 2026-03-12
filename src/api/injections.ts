/**
 * Injection API
 * Using @rcabench/client SDK, manually implementing missing endpoints
 */
import {
  type BatchManageInjectionLabelReq,
  type DatapackState,
  type GetInjectionMetadataSystem,
  type InjectionDetailResp,
  type InjectionNoIssuesResp,
  InjectionsApi,
  type InjectionWithIssuesResp,
  type LabelItem,
  type ListInjectionResp,
  type ListInjectionsType,
  type SubmitDatapackBuildingReq,
  type SubmitInjectionReq,
} from '@rcabench/client';

import { apiClient, createApiConfig, createFileApiConfig } from './config';

// Re-export types for convenience
export type { InjectionDetailResp } from '@rcabench/client';

export const injectionApi = {
  // ==================== SDK Methods ====================

  /**
   * List injections
   */
  listInjections: async (params?: {
    page?: number;
    size?: number;
    fault_type?: string;
    benchmark?: string;
    state?: DatapackState;
    status?: number;
    labels?: string[];
  }): Promise<ListInjectionResp | undefined> => {
    const api = new InjectionsApi(createApiConfig());
    const response = await api.listInjections({
      page: params?.page,
      size: params?.size,
      type: params?.fault_type as ListInjectionsType | undefined,
      benchmark: params?.benchmark,
      state: params?.state,
      status: params?.status,
      labels: params?.labels,
    });
    return response.data.data;
  },

  /**
   * Get injection detail
   */
  getInjection: async (
    id: number
  ): Promise<InjectionDetailResp | undefined> => {
    const api = new InjectionsApi(createApiConfig());
    const response = await api.getInjectionById({ id });
    return response.data.data;
  },

  /**
   * Submit injection - Using SDK
   */
  submitInjection: async (data: SubmitInjectionReq) => {
    const api = new InjectionsApi(createApiConfig());
    const response = await api.injectFault({ body: data });
    return response.data.data;
  },

  /**
   * Build datapack - Using SDK
   */
  buildDatapack: async (data: SubmitDatapackBuildingReq) => {
    const api = new InjectionsApi(createApiConfig());
    const response = await api.buildDatapack({ body: data });
    return response.data.data;
  },

  /**
   * Get fault metadata - Using SDK
   */
  getFaultMetadata: async (system: GetInjectionMetadataSystem) => {
    const api = new InjectionsApi(createApiConfig());
    const response = await api.getInjectionMetadata({ system });
    return response.data.data;
  },

  /**
   * Get failed injections (no issues) - Using SDK
   */
  getNoIssues: async (params?: {
    labels?: string[];
    lookback?: string;
    customStartTime?: string;
    customEndTime?: string;
  }): Promise<InjectionNoIssuesResp[] | undefined> => {
    const api = new InjectionsApi(createApiConfig());
    const response = await api.listFailedInjections({
      labels: params?.labels,
      lookback: params?.lookback,
      customStartTime: params?.customStartTime,
      customEndTime: params?.customEndTime,
    });
    return response.data.data;
  },

  /**
   * Get successful injections (with issues) - Using SDK
   */
  getWithIssues: async (params?: {
    labels?: string[];
    lookback?: string;
    customStartTime?: string;
    customEndTime?: string;
  }): Promise<InjectionWithIssuesResp[] | undefined> => {
    const api = new InjectionsApi(createApiConfig());
    const response = await api.listSuccessfulInjections({
      labels: params?.labels,
      lookback: params?.lookback,
      customStartTime: params?.customStartTime,
      customEndTime: params?.customEndTime,
    });
    return response.data.data;
  },

  /**
   * Manage injection labels - Using SDK
   */
  manageLabels: async (
    id: number,
    add_labels: LabelItem[],
    remove_labels: LabelItem[]
  ) => {
    const removeLabelKeys = remove_labels
      .filter((l) => l.key !== undefined)
      .map((l) => l.key as string);
    const api = new InjectionsApi(createApiConfig());
    const response = await api.manageInjectionLabels({
      id,
      manage: { add_labels, remove_labels: removeLabelKeys },
    });
    return response.data.data;
  },

  /**
   * Batch manage injection labels - Using SDK
   */
  batchManageLabels: async (data: {
    injection_ids: number[];
    add_labels?: LabelItem[];
    remove_labels?: string[];
  }) => {
    const api = new InjectionsApi(createApiConfig());
    const batchManage: BatchManageInjectionLabelReq = {
      items: data.injection_ids.map((id) => ({
        injection_id: id,
        add_labels: data.add_labels,
        remove_labels: data.remove_labels?.map((key) => ({ key })),
      })),
    };
    const response = await api.batchManageInjectionLabels({ batchManage });
    return response.data.data;
  },

  listDatapackFiles: async (id: number) => {
    const api = new InjectionsApi(createApiConfig());
    const response = await api.listDatapackFiles({ id });
    return response.data.data;
  },

  downloadDatapackFile: async (id: number, path: string) => {
    const api = new InjectionsApi(createFileApiConfig());
    const response = await api.downloadDatapackFile({ id, path });
    return response.data;
  },

  /**
   * Query datapack file content with pagination - Manual implementation (SDK missing)
   */
  queryDatapackFileContent: async (id: number, path: string) => {
    const token = localStorage.getItem('access_token');
    const response = await fetch(
      `/api/v2/injections/${id}/files/query?path=${encodeURIComponent(path)}`,
      {
        method: 'GET',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response
        .json()
        .then((data) => data.message || JSON.stringify(data))
        .catch(() => response.statusText);
      throw new Error(
        `Failed to query datapack file content: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response;
  },

  // ==================== Manual Implementation (SDK Missing) ====================

  /**
   * Update labels (replace all) - Manual implementation (SDK uses incremental modification)
   */
  updateLabels: (id: number, labels: Array<{ key: string; value: string }>) =>
    apiClient.patch(`/injections/${id}/labels`, { labels }),

  /**
   * Batch delete injections - Manual implementation (SDK missing)
   */
  batchDelete: (ids: number[]) =>
    apiClient.post('/injections/batch-delete', { ids }),

  /**
   * Create injection (visual creation) - Manual implementation (SDK missing)
   */
  createInjection: async (data: {
    project_id: number;
    name: string;
    description?: string;
    container_config: {
      pedestal_container_id: number;
      benchmark_container_id: number;
      algorithm_container_ids: number[];
    };
    fault_matrix: Array<
      Array<{
        id: number;
        name: string;
        type: string;
        category?: string;
        parameters?: unknown[];
      }>
    >;
    experiment_params: {
      duration: number;
      interval: number;
      parallel: boolean;
    };
    tags?: string[];
  }) => {
    const response = await apiClient.post('/injections', data);
    return response.data;
  },
};
