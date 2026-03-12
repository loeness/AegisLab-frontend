/**
 * Execution API
 * Using @rcabench/client SDK, manually implementing missing endpoints
 */
import {
  type ContainerSpec,
  type DetectorResultItem,
  type ExecutionDetailResp,
  ExecutionsApi,
  type ExecutionSpec,
  type ExecutionState,
  type GranularityResultItem,
  type LabelItem,
  type ListExecutionResp,
  type StatusType,
  type SubmitExecutionReq,
  type UploadDetectorResultReq,
  type UploadGranularityResultReq,
} from '@rcabench/client';

import { apiClient, createApiConfig } from './config';

export const executionApi = {
  // ==================== SDK Methods ====================

  /**
   * Get execution list - Using SDK
   */
  getExecutions: async (params?: {
    page?: number;
    size?: number;
    state?: ExecutionState;
    status?: StatusType;
    labels?: string[];
  }): Promise<ListExecutionResp> => {
    const api = new ExecutionsApi(createApiConfig());
    const response = await api.listExecutions({
      page: params?.page,
      size: params?.size,
      state: params?.state,
      status: params?.status,
      labels: params?.labels,
    });
    return response.data.data as ListExecutionResp;
  },

  /**
   * Get execution details - Using SDK
   */
  getExecution: async (id: number): Promise<ExecutionDetailResp> => {
    const api = new ExecutionsApi(createApiConfig());
    const response = await api.getExecutionById({ id });
    return response.data.data as ExecutionDetailResp;
  },

  /**
   * Execute algorithm - Using SDK
   */
  executeAlgorithm: async (data: {
    algorithmName: string;
    algorithmVersion: string;
    datapackId: string;
    labels?: Array<{ key: string; value: string }>;
  }) => {
    const api = new ExecutionsApi(createApiConfig());
    const algorithm: ContainerSpec = {
      name: data.algorithmName,
      version: data.algorithmVersion,
    };
    const spec: ExecutionSpec = {
      algorithm,
      datapack: data.datapackId,
    };
    const request: SubmitExecutionReq = {
      project_name: 'default',
      specs: [spec],
      labels: data.labels as LabelItem[],
    };
    const response = await api.runAlgorithm({ request });
    return response.data.data;
  },

  /**
   * Upload detector results - Using SDK
   */
  uploadDetectorResults: async (
    id: number,
    data: { duration: number; results: DetectorResultItem[] }
  ) => {
    const api = new ExecutionsApi(createApiConfig());
    const request: UploadDetectorResultReq = {
      duration: data.duration,
      results: data.results,
    };
    const response = await api.uploadDetectionResults({
      executionId: id,
      request,
    });
    return response.data.data;
  },

  /**
   * Upload localization results - Using SDK
   */
  uploadGranularityResults: async (
    id: number,
    data: { duration: number; results: GranularityResultItem[] }
  ) => {
    const api = new ExecutionsApi(createApiConfig());
    const request: UploadGranularityResultReq = {
      duration: data.duration,
      results: data.results,
    };
    const response = await api.uploadLocalizationResults({
      executionId: id,
      request,
    });
    return response.data.data;
  },

  /**
   * Get execution label list - Using SDK
   */
  getExecutionLabels: async (): Promise<LabelItem[] | undefined> => {
    const api = new ExecutionsApi(createApiConfig());
    const response = await api.listExecutionLabels();
    return response.data.data;
  },

  // ==================== Manual Implementation (SDK Missing) ====================

  /**
   * Update execution labels - Manual implementation (SDK missing)
   */
  updateLabels: (id: number, labels: Array<{ key: string; value: string }>) =>
    apiClient.patch(`/executions/${id}/labels`, { labels }),

  /**
   * Batch delete executions - Manual implementation (SDK missing)
   */
  batchDelete: (ids: number[]) =>
    apiClient.post('/executions/batch-delete', { ids }),

  /**
   * Search executions with sort/filter - Manual implementation (POST /search)
   */
  searchExecutions: async (params: {
    project_id?: number;
    page?: number;
    size?: number;
    search?: string;
    sort_by?: Array<{ field: string; order: 'asc' | 'desc' }>;
    filters?: Record<string, unknown>;
  }): Promise<ListExecutionResp> => {
    const response = await apiClient.post<{
      data: ListExecutionResp;
    }>('/executions/search', params);
    return response.data.data;
  },
};
