import type {
  ObjectTypeManifest,
  CreateObjectInput,
  UpdateObjectInput,
  ObjectFilter,
  PlatformObject,
  RequestContext,
  PaginatedResult,
} from './object-model.types.js';
import type { ObjectState } from '@rasid/shared';

/** K2 Object Model — public contract */
export interface IObjectModelService {
  registerType(manifest: ObjectTypeManifest): Promise<void>;
  createObject(input: CreateObjectInput, ctx: RequestContext): Promise<PlatformObject>;
  getObject(id: string, ctx: RequestContext): Promise<PlatformObject | null>;
  updateObject(id: string, patch: UpdateObjectInput, ctx: RequestContext): Promise<PlatformObject>;
  deleteObject(id: string, ctx: RequestContext): Promise<void>;
  transitionState(id: string, newState: ObjectState, ctx: RequestContext): Promise<PlatformObject>;
  listObjects(filter: ObjectFilter, ctx: RequestContext): Promise<PaginatedResult<PlatformObject>>;
}
