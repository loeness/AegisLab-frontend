/**
 * Project API
 * Using @rcabench/client SDK, manually implementing missing endpoints
 */
import {
  type CreateProjectReq,
  type InjectionField,
  type InjectionResp,
  type LabelItem,
  type ListProjectResp,
  type PageSize,
  type ProjectDetailResp,
  type ProjectResp,
  ProjectsApi,
  type SortDirection,
  type StatusType,
} from '@rcabench/client';

import { apiClient, createApiConfig } from './config';

export const projectApi = {
  /**
   * Get project list - Using SDK
   */
  getProjects: async (params?: {
    page?: number;
    size?: number;
    isPublic?: boolean;
    status?: StatusType;
  }): Promise<ListProjectResp | undefined> => {
    const api = new ProjectsApi(createApiConfig());
    const response = await api.listProjects({
      page: params?.page,
      size: params?.size,
      isPublic: params?.isPublic,
      status: params?.status,
    });
    return response.data.data;
  },

  /**
   * Get project details
   */
  getProjectDetail: async (
    id: number
  ): Promise<ProjectDetailResp | undefined> => {
    const api = new ProjectsApi(createApiConfig());
    const response = await api.getProjectById({ projectId: id });
    return response.data.data;
  },

  /**
   * List project injections
   */
  listProjectInjections: async (
    projectId: number,
    params?: { page?: number; size?: PageSize }
  ): Promise<{
    items: InjectionResp[];
    total: number;
  }> => {
    const api = new ProjectsApi(createApiConfig());
    const response = await api.listProjectInjections({ projectId, ...params });
    return {
      items: response.data.data?.items || [],
      total: response.data.data?.pagination?.total || 0,
    };
  },

  /**
   * Search project injections with sort/filter support
   */
  searchProjectInjections: async (
    projectId: number,
    body?: {
      page?: number;
      size?: number;
      search?: string;
      sort_by?: Array<{ field: string; order: 'asc' | 'desc' }>;
    }
  ): Promise<{ items: InjectionResp[]; total: number }> => {
    const api = new ProjectsApi(createApiConfig());
    const response = await api.searchProjectInjections({
      projectId,
      search: {
        name_pattern: body?.search,
        page: body?.page,
        size: body?.size as PageSize | undefined,
        sort: body?.sort_by?.map((sf) => ({
          field: sf.field as InjectionField,
          direction: sf.order as SortDirection,
        })),
      },
    });
    return {
      items: (response.data.data?.items ?? []) as InjectionResp[],
      total: response.data.data?.pagination?.total ?? 0,
    };
  },

  /**
   * Create project
   */
  createProject: async (data: {
    name: string;
    description?: string;
    is_public?: boolean;
  }): Promise<ProjectResp | undefined> => {
    const api = new ProjectsApi(createApiConfig());
    const request: CreateProjectReq = {
      name: data.name,
      description: data.description,
      is_public: data.is_public ?? false,
    };
    const response = await api.createProject({ request });
    return response.data.data;
  },

  // ==================== Manual Implementation (SDK Missing) ====================

  /**
   * Update project - Manual implementation (SDK missing)
   */
  updateProject: (
    id: number,
    data: {
      name?: string;
      description?: string;
      is_public?: boolean;
      labels?: LabelItem[];
    }
  ) => apiClient.patch<{ data: ProjectDetailResp }>(`/projects/${id}`, data),

  /**
   * Delete project - Manual implementation (SDK missing)
   */
  deleteProject: (id: number) => apiClient.delete(`/projects/${id}`),

  /**
   * Manage labels - Manual implementation (SDK missing)
   */
  updateLabels: (id: number, labels: Array<{ key: string; value: string }>) =>
    apiClient.patch(`/projects/${id}/labels`, { labels }),
};
