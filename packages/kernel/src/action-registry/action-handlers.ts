import { actionRegistry } from './action-registry.service.js';
import { objectModelService } from '../object-model/object-model.service.js';
import type { ActionManifest, ActionHandler } from './action-registry.types.js';
import type { CreateObjectInput, UpdateObjectInput } from '../object-model/object-model.types.js';
import type { ObjectState } from '@rasid/shared';

/** Object action manifests */
const objectManifests: Array<{ manifest: ActionManifest; handler: ActionHandler }> = [
  {
    manifest: {
      action_id: 'rasid.core.object.create',
      display_name: 'Create Object',
      module_id: 'kernel',
      verb: 'create',
      resource: 'objects',
      input_schema: {
        type: 'object',
        required: ['type', 'data'],
        properties: {
          type: { type: 'string' },
          data: { type: 'object' },
        },
      },
      output_schema: { type: 'object' },
      required_permissions: ['objects.create'],
      sensitivity: 'low',
    },
    handler: async (input, ctx, sql) => {
      const { type, data } = input as CreateObjectInput;
      const obj = await objectModelService.createObject({ type, data }, ctx, sql);
      return {
        data: obj,
        object_id: obj.id,
        object_type: obj.type,
        before: null,
        after: obj,
        event_type: 'rasid.core.object.created',
      };
    },
  },
  {
    manifest: {
      action_id: 'rasid.core.object.update',
      display_name: 'Update Object',
      module_id: 'kernel',
      verb: 'update',
      resource: 'objects',
      input_schema: {
        type: 'object',
        required: ['id', 'data'],
        properties: {
          id: { type: 'string' },
          data: { type: 'object' },
        },
      },
      output_schema: { type: 'object' },
      required_permissions: ['objects.update'],
      sensitivity: 'low',
    },
    handler: async (input, ctx, sql) => {
      const { id, data } = input as { id: string; data: Record<string, unknown> };
      const before = await objectModelService.getObject(id, ctx, sql);
      const obj = await objectModelService.updateObject(id, { data } as UpdateObjectInput, ctx, sql);
      return {
        data: obj,
        object_id: obj.id,
        object_type: obj.type,
        before,
        after: obj,
        event_type: 'rasid.core.object.updated',
      };
    },
  },
  {
    manifest: {
      action_id: 'rasid.core.object.delete',
      display_name: 'Delete Object',
      module_id: 'kernel',
      verb: 'delete',
      resource: 'objects',
      input_schema: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      output_schema: { type: 'object' },
      required_permissions: ['objects.delete'],
      sensitivity: 'medium',
    },
    handler: async (input, ctx, sql) => {
      const { id } = input as { id: string };
      const before = await objectModelService.getObject(id, ctx, sql);
      await objectModelService.deleteObject(id, ctx, sql);
      return {
        data: { deleted: true },
        object_id: id,
        object_type: before?.type ?? null,
        before,
        after: null,
        event_type: 'rasid.core.object.deleted',
      };
    },
  },
  {
    manifest: {
      action_id: 'rasid.core.object.transition',
      display_name: 'Transition Object State',
      module_id: 'kernel',
      verb: 'update',
      resource: 'objects',
      input_schema: {
        type: 'object',
        required: ['id', 'state'],
        properties: {
          id: { type: 'string' },
          state: { type: 'string' },
        },
      },
      output_schema: { type: 'object' },
      required_permissions: ['objects.update'],
      sensitivity: 'medium',
    },
    handler: async (input, ctx, sql) => {
      const { id, state } = input as { id: string; state: ObjectState };
      const before = await objectModelService.getObject(id, ctx, sql);
      const obj = await objectModelService.transitionState(id, state, ctx, sql);
      return {
        data: obj,
        object_id: obj.id,
        object_type: obj.type,
        before,
        after: obj,
        event_type: 'rasid.core.object.state_changed',
      };
    },
  },
];

/** Register all object action handlers */
export function registerObjectActions(): void {
  for (const { manifest, handler } of objectManifests) {
    actionRegistry.registerAction(manifest, handler);
  }
}
