/**
 * M17 File Manager -- K3 Action Registration
 *
 * Metadata-only file management. No binary storage.
 * All actions registered via K3 pipeline for RBAC + audit.
 * Handler signature: (input, ctx, sql) matching ActionHandler type.
 * Schema: mod_file_manager
 */

import { actionRegistry } from '../../../kernel/src/index.js';
import { FileManagerService } from './file-manager.service.js';
import { ValidationError } from '@rasid/shared';
import {
  createFileSchema, updateFileSchema,
  createFolderSchema, updateFolderSchema, moveFileSchema,
} from './file-manager.schema.js';
import type {
  CreateFileInput, UpdateFileInput,
  CreateFolderInput, UpdateFolderInput,
} from './file-manager.types.js';

const svc = new FileManagerService();

export function registerFileManagerActions() {

  // ═══════════════════════════════════════════
  // FOLDER CRUD
  // ═══════════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.file_manager.folder.create',
      display_name: 'Create Folder',
      module_id: 'mod_file_manager',
      verb: 'create',
      resource: 'folders',
      input_schema: { type: 'object', required: ['name'] },
      output_schema: {},
      required_permissions: ['folders.create'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const parsed = createFolderSchema.safeParse(input);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '));
      }
      const folder = await svc.createFolder(sql, ctx.tenantId, ctx.userId, parsed.data as CreateFolderInput);
      return {
        data: folder,
        object_id: folder.id,
        object_type: 'folder',
        before: null,
        after: folder,
        event_type: 'rasid.mod.file_manager.folder.created',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.file_manager.folder.list',
      display_name: 'List Folders',
      module_id: 'mod_file_manager',
      verb: 'read',
      resource: 'folders',
      input_schema: { type: 'object' },
      output_schema: {},
      required_permissions: ['folders.read'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { parent_id } = input as { parent_id?: string };
      const data = await svc.listFolders(sql, ctx.tenantId, parent_id || null);
      return {
        data,
        object_id: null,
        object_type: 'folder',
        before: null,
        after: null,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.file_manager.folder.get',
      display_name: 'Get Folder',
      module_id: 'mod_file_manager',
      verb: 'read',
      resource: 'folders',
      input_schema: { type: 'object', required: ['id'] },
      output_schema: {},
      required_permissions: ['folders.read'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { id } = input as { id: string };
      const data = await svc.getFolder(sql, ctx.tenantId, id);
      return {
        data,
        object_id: id,
        object_type: 'folder',
        before: null,
        after: null,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.file_manager.folder.update',
      display_name: 'Update Folder',
      module_id: 'mod_file_manager',
      verb: 'update',
      resource: 'folders',
      input_schema: { type: 'object', required: ['id'] },
      output_schema: {},
      required_permissions: ['folders.update'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { id, ...rest } = input as { id: string } & Record<string, unknown>;
      const parsed = updateFolderSchema.safeParse(rest);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '));
      }
      const folder = await svc.updateFolder(sql, ctx.tenantId, id, parsed.data as UpdateFolderInput);
      return {
        data: folder,
        object_id: folder.id,
        object_type: 'folder',
        before: null,
        after: folder,
        event_type: 'rasid.mod.file_manager.folder.updated',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.file_manager.folder.delete',
      display_name: 'Delete Folder',
      module_id: 'mod_file_manager',
      verb: 'delete',
      resource: 'folders',
      input_schema: { type: 'object', required: ['id'] },
      output_schema: {},
      required_permissions: ['folders.delete'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { id } = input as { id: string };
      await svc.deleteFolder(sql, ctx.tenantId, id);
      return {
        data: null,
        object_id: id,
        object_type: 'folder',
        before: null,
        after: null,
        event_type: 'rasid.mod.file_manager.folder.deleted',
      };
    },
  );

  // ═══════════════════════════════════════════
  // FILE CRUD (metadata only)
  // ═══════════════════════════════════════════

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.file_manager.file.create',
      display_name: 'Create File Metadata',
      module_id: 'mod_file_manager',
      verb: 'create',
      resource: 'files',
      input_schema: { type: 'object', required: ['name', 'mime_type', 'size_bytes'] },
      output_schema: {},
      required_permissions: ['files.create'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const parsed = createFileSchema.safeParse(input);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '));
      }
      const file = await svc.createFile(sql, ctx.tenantId, ctx.userId, parsed.data as CreateFileInput);
      return {
        data: file,
        object_id: file.id,
        object_type: 'file',
        before: null,
        after: file,
        event_type: 'rasid.mod.file_manager.file.created',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.file_manager.file.list',
      display_name: 'List Files',
      module_id: 'mod_file_manager',
      verb: 'read',
      resource: 'files',
      input_schema: { type: 'object' },
      output_schema: {},
      required_permissions: ['files.read'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { folder_id } = input as { folder_id?: string };
      const data = await svc.listFiles(sql, ctx.tenantId, folder_id || null);
      return {
        data,
        object_id: null,
        object_type: 'file',
        before: null,
        after: null,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.file_manager.file.get',
      display_name: 'Get File Metadata',
      module_id: 'mod_file_manager',
      verb: 'read',
      resource: 'files',
      input_schema: { type: 'object', required: ['id'] },
      output_schema: {},
      required_permissions: ['files.read'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { id } = input as { id: string };
      const data = await svc.getFile(sql, ctx.tenantId, id);
      return {
        data,
        object_id: id,
        object_type: 'file',
        before: null,
        after: null,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.file_manager.file.update',
      display_name: 'Update File Metadata',
      module_id: 'mod_file_manager',
      verb: 'update',
      resource: 'files',
      input_schema: { type: 'object', required: ['id'] },
      output_schema: {},
      required_permissions: ['files.update'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { id, ...rest } = input as { id: string } & Record<string, unknown>;
      const parsed = updateFileSchema.safeParse(rest);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '));
      }
      const file = await svc.updateFile(sql, ctx.tenantId, id, parsed.data as UpdateFileInput);
      return {
        data: file,
        object_id: file.id,
        object_type: 'file',
        before: null,
        after: file,
        event_type: 'rasid.mod.file_manager.file.updated',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.file_manager.file.move',
      display_name: 'Move File',
      module_id: 'mod_file_manager',
      verb: 'update',
      resource: 'files',
      input_schema: { type: 'object', required: ['id', 'folder_id'] },
      output_schema: {},
      required_permissions: ['files.update'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { id, ...rest } = input as { id: string } & Record<string, unknown>;
      const parsed = moveFileSchema.safeParse(rest);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '));
      }
      const file = await svc.moveFile(sql, ctx.tenantId, id, parsed.data.folder_id);
      return {
        data: file,
        object_id: file.id,
        object_type: 'file',
        before: null,
        after: file,
        event_type: 'rasid.mod.file_manager.file.moved',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.file_manager.file.archive',
      display_name: 'Archive File',
      module_id: 'mod_file_manager',
      verb: 'update',
      resource: 'files',
      input_schema: { type: 'object', required: ['id'] },
      output_schema: {},
      required_permissions: ['files.update'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { id } = input as { id: string };
      const file = await svc.archiveFile(sql, ctx.tenantId, id);
      return {
        data: file,
        object_id: file.id,
        object_type: 'file',
        before: null,
        after: file,
        event_type: 'rasid.mod.file_manager.file.archived',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.file_manager.file.delete',
      display_name: 'Delete File Metadata',
      module_id: 'mod_file_manager',
      verb: 'delete',
      resource: 'files',
      input_schema: { type: 'object', required: ['id'] },
      output_schema: {},
      required_permissions: ['files.delete'],
      sensitivity: 'low',
    },
    async (input, ctx, sql) => {
      const { id } = input as { id: string };
      await svc.deleteFile(sql, ctx.tenantId, id);
      return {
        data: null,
        object_id: id,
        object_type: 'file',
        before: null,
        after: null,
        event_type: 'rasid.mod.file_manager.file.deleted',
      };
    },
  );
}
