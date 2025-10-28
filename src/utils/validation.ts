import Joi from 'joi';

// Device validation schemas
export const listDevicesSchema = Joi.object({
  filter: Joi.string().optional().description('LogicMonitor query syntax. Available operators: >: (greater than or equals), <: (less than or equals), > (greater than), < (less than), !: (does not equal), : (equals), ~ (includes), !~ (does not include).'),
  size: Joi.number().min(1).max(1000).optional(),
  offset: Joi.number().min(0).optional(),
  fields: Joi.string().optional(),
  start: Joi.number().optional(),
  end: Joi.number().optional(),
  netflowFilter: Joi.string().optional(),
  includeDeletedResources: Joi.boolean().optional(),
  returnMode: Joi.string().valid('summary', 'raw', 'both').optional()
}).unknown(false);

export const getDeviceSchema = Joi.object({
  deviceId: Joi.number().required(),
  fields: Joi.string().optional(),
  start: Joi.number().optional(),
  end: Joi.number().optional(),
  netflowFilter: Joi.string().optional(),
  needStcGrpAndSortedCP: Joi.boolean().optional(),
  returnMode: Joi.string().valid('summary', 'raw', 'both').optional()
}).unknown(false);

const singleDeviceSchema = Joi.object({
  displayName: Joi.string().required(),
  name: Joi.string().required(),
  hostGroupIds: Joi.array().items(Joi.number()).min(1).required(),
  preferredCollectorId: Joi.number().required(),
  disableAlerting: Joi.boolean().optional(),
  properties: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      value: Joi.string().required()
    })
  ).optional()
}).unknown(true);

export const createDeviceSchema = Joi.object({
  // Single device properties
  displayName: Joi.string().when('devices', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required()
  }),
  name: Joi.string().when('devices', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required()
  }),
  hostGroupIds: Joi.array().items(Joi.number()).min(1).when('devices', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required()
  }),
  preferredCollectorId: Joi.number().when('devices', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required()
  }),
  disableAlerting: Joi.boolean().optional(),
  properties: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      value: Joi.string().required()
    }).unknown(true)
  ).optional(),
  // Batch properties
  devices: Joi.array().items(singleDeviceSchema).min(1).optional(),
  batchOptions: Joi.object({
    maxConcurrent: Joi.number().min(1).max(50).optional(),
    continueOnError: Joi.boolean().optional()
  }).optional(),
  returnMode: Joi.string().valid('summary', 'raw', 'both').optional()
}).xor('displayName', 'devices').unknown(true);

const singleUpdateDeviceSchema = Joi.object({
  deviceId: Joi.number().required(),
  displayName: Joi.string().optional(),
  hostGroupIds: Joi.array().items(Joi.number()).optional(),
  disableAlerting: Joi.boolean().optional(),
  customProperties: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      value: Joi.string().required()
    })
  ).optional()
}).unknown(true);

export const updateDeviceSchema = Joi.object({
  // Single device properties
  deviceId: Joi.number().when('devices', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required()
  }),
  displayName: Joi.string().optional(),
  hostGroupIds: Joi.array().items(Joi.number()).optional(),
  disableAlerting: Joi.boolean().optional(),
  customProperties: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      value: Joi.string().required()
    })
  ).optional(),
  // Batch properties
  devices: Joi.array().items(singleUpdateDeviceSchema).min(1).optional(),
  batchOptions: Joi.object({
    maxConcurrent: Joi.number().min(1).max(50).optional(),
    continueOnError: Joi.boolean().optional()
  }).optional(),
  returnMode: Joi.string().valid('summary', 'raw', 'both').optional()
}).xor('deviceId', 'devices').unknown(true);

const singleDeleteDeviceSchema = Joi.object({
  deviceId: Joi.number().required()
});

export const deleteDeviceSchema = Joi.object({
  // Single device properties
  deviceId: Joi.number().when('devices', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required()
  }),
  // Batch properties
  devices: Joi.array().items(singleDeleteDeviceSchema).min(1).optional(),
  batchOptions: Joi.object({
    maxConcurrent: Joi.number().min(1).max(50).optional(),
    continueOnError: Joi.boolean().optional()
  }).optional(),
  returnMode: Joi.string().valid('summary', 'raw', 'both').optional()
}).xor('deviceId', 'devices').unknown(true);

// Device Group validation schemas
export const listDeviceGroupsSchema = Joi.object({
  filter: Joi.string().optional().description('LogicMonitor query syntax. Available operators: >: (greater than or equals), <: (less than or equals), > (greater than), < (less than), !: (does not equal), : (equals), ~ (includes), !~ (does not include).'),
  size: Joi.number().min(1).max(1000).optional(),
  offset: Joi.number().min(0).optional(),
  fields: Joi.string().optional(),
  parentId: Joi.number().optional()
}).unknown(false);

export const getDeviceGroupSchema = Joi.object({
  groupId: Joi.number().required()
}).unknown(false);

const singleDeviceGroupSchema = Joi.object({
  name: Joi.string().required(),
  parentId: Joi.number().required(),
  description: Joi.string().optional(),
  appliesTo: Joi.string().optional(),
  properties: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      value: Joi.string().required()
    })
  ).optional()
}).unknown(true);

export const createDeviceGroupSchema = Joi.object({
  // Single group properties
  name: Joi.string().when('groups', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required()
  }),
  parentId: Joi.number().when('groups', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required()
  }),
  description: Joi.string().optional(),
  appliesTo: Joi.string().optional(),
  properties: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      value: Joi.string().required()
    })
  ).optional(),
  // Batch properties
  groups: Joi.array().items(singleDeviceGroupSchema).min(1).optional(),
  batchOptions: Joi.object({
    maxConcurrent: Joi.number().min(1).max(50).optional(),
    continueOnError: Joi.boolean().optional()
  }).optional()
}).xor('name', 'groups').unknown(true);

const singleUpdateDeviceGroupSchema = Joi.object({
  groupId: Joi.number().required(),
  name: Joi.string().optional(),
  description: Joi.string().optional(),
  appliesTo: Joi.string().optional(),
  customProperties: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      value: Joi.string().required()
    })
  ).optional()
}).unknown(true);

export const updateDeviceGroupSchema = Joi.object({
  // Single group properties
  groupId: Joi.number().when('groups', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required()
  }),
  name: Joi.string().optional(),
  description: Joi.string().optional(),
  appliesTo: Joi.string().optional(),
  customProperties: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      value: Joi.string().required()
    })
  ).optional(),
  // Batch properties
  groups: Joi.array().items(singleUpdateDeviceGroupSchema).min(1).optional(),
  batchOptions: Joi.object({
    maxConcurrent: Joi.number().min(1).max(50).optional(),
    continueOnError: Joi.boolean().optional()
  }).optional()
}).xor('groupId', 'groups').unknown(true);

const singleDeleteDeviceGroupSchema = Joi.object({
  groupId: Joi.number().required(),
  deleteChildren: Joi.boolean().optional()
}).unknown(true);

export const deleteDeviceGroupSchema = Joi.object({
  // Single group properties
  groupId: Joi.number().when('groups', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required()
  }),
  deleteChildren: Joi.boolean().optional(),
  // Batch properties
  groups: Joi.array().items(singleDeleteDeviceGroupSchema).min(1).optional(),
  batchOptions: Joi.object({
    maxConcurrent: Joi.number().min(1).max(50).optional(),
    continueOnError: Joi.boolean().optional()
  }).optional()
}).xor('groupId', 'groups').unknown(true);

// Collector validation schemas
export const listCollectorsSchema = Joi.object({
  filter: Joi.string().optional().description('LogicMonitor query syntax. Available operators: >: (greater than or equals), <: (less than or equals), > (greater than), < (less than), !: (does not equal), : (equals), ~ (includes), !~ (does not include).'),
  size: Joi.number().min(1).max(1000).optional(),
  offset: Joi.number().min(0).optional(),
  fields: Joi.string().optional()
}).unknown(false);

// Alert validation schemas
export const listAlertsSchema = Joi.object({
  filter: Joi.string().optional().description('LogicMonitor filter string. Note that filtering is only available for id, type, acked, rule, chain, severity, cleared, sdted, startEpoch, monitorObjectName, monitorObjectGroups, resourceTemplateName, instanceName, and dataPointName. Available operators: >: (greater than or equals), <: (less than or equals), > (greater than), < (less than), !: (does not equal), : (equals), ~ (includes), !~ (does not include).'),
  fields: Joi.string().optional(),
  size: Joi.number().min(1).max(1000).optional(),
  offset: Joi.number().min(0).optional(),
  sort: Joi.string().optional(),
  needMessage: Joi.boolean().optional(),
  customColumns: Joi.string().optional()
});

export const getAlertSchema = Joi.object({
  alertId: Joi.string().required()
});

export const ackAlertSchema = Joi.object({
  alertId: Joi.string().required(),
  ackComment: Joi.string().required()
});

export const addAlertNoteSchema = Joi.object({
  alertId: Joi.string().required(),
  ackComment: Joi.string().required()
});

export const escalateAlertSchema = Joi.object({
  alertId: Joi.string().required()
});

// Website validation schemas
export const listWebsitesSchema = Joi.object({
  filter: Joi.string().optional().description('LogicMonitor query syntax. Available operators: >: (greater than or equals), <: (less than or equals), > (greater than), < (less than), !: (does not equal), : (equals), ~ (includes), !~ (does not include).'),
  size: Joi.number().min(1).max(1000).optional(),
  offset: Joi.number().min(0).optional(),
  fields: Joi.string().optional(),
  collectorIds: Joi.string().optional()
}).unknown(false);

export const getWebsiteSchema = Joi.object({
  websiteId: Joi.number().required()
}).unknown(false);

export const createWebsiteSchema = Joi.object({
  // Single website properties
  name: Joi.string().when('websites', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required()
  }),
  domain: Joi.string().when('websites', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required()
  }),
  type: Joi.string().valid('webcheck', 'pingcheck').when('websites', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required()
  }),
  groupId: Joi.number().when('websites', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required()
  }),
  description: Joi.string().optional(),
  disableAlerting: Joi.boolean().optional(),
  stopMonitoring: Joi.boolean().optional(),
  useDefaultAlertSetting: Joi.boolean().optional(),
  useDefaultLocationSetting: Joi.boolean().optional(),
  pollingInterval: Joi.number().optional(),
  properties: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      value: Joi.string().required()
    })
  ).optional(),
  steps: Joi.array().items(
    Joi.object({
      url: Joi.string().required(),
      HTTPMethod: Joi.string().optional(),
      statusCode: Joi.string().optional(),
      description: Joi.string().optional()
    }).unknown(true)
  ).optional(),
  // Batch mode properties
  websites: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      domain: Joi.string().required(),
      type: Joi.string().valid('webcheck', 'pingcheck').required(),
      groupId: Joi.number().required(),
      description: Joi.string().optional(),
      disableAlerting: Joi.boolean().optional(),
      stopMonitoring: Joi.boolean().optional(),
      useDefaultAlertSetting: Joi.boolean().optional(),
      useDefaultLocationSetting: Joi.boolean().optional(),
      pollingInterval: Joi.number().optional(),
      properties: Joi.array().items(
        Joi.object({
          name: Joi.string().required(),
          value: Joi.string().required()
        }).unknown(true)
      ).optional(),
      steps: Joi.array().items(
        Joi.object({
          url: Joi.string().required(),
          HTTPMethod: Joi.string().optional(),
          statusCode: Joi.string().optional(),
          description: Joi.string().optional()
        }).unknown(true)
      ).optional()
    }).unknown(true)
  ),
  batchOptions: Joi.object({
    maxConcurrent: Joi.number().min(1).max(20).optional(),
    continueOnError: Joi.boolean().optional()
  }).optional()
}).xor('name', 'websites').unknown(true);

export const updateWebsiteSchema = Joi.object({
  websiteId: Joi.number().when('websites', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required()
  }),
  // Single mode properties
  name: Joi.string().optional(),
  description: Joi.string().optional(),
  disableAlerting: Joi.boolean().optional(),
  stopMonitoring: Joi.boolean().optional(),
  useDefaultAlertSetting: Joi.boolean().optional(),
  useDefaultLocationSetting: Joi.boolean().optional(),
  pollingInterval: Joi.number().optional(),
  properties: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      value: Joi.string().required()
    }).unknown(true)
  ).optional(),
  // Batch mode properties
  websites: Joi.array().items(
    Joi.object({
      websiteId: Joi.number().required(),
      name: Joi.string().optional(),
      description: Joi.string().optional(),
      disableAlerting: Joi.boolean().optional(),
      stopMonitoring: Joi.boolean().optional(),
      useDefaultAlertSetting: Joi.boolean().optional(),
      useDefaultLocationSetting: Joi.boolean().optional(),
      pollingInterval: Joi.number().optional(),
      properties: Joi.array().items(
        Joi.object({
          name: Joi.string().required(),
          value: Joi.string().required()
        }).unknown(true)
      ).optional()
    }).unknown(true)
  ),
  batchOptions: Joi.object({
    maxConcurrent: Joi.number().min(1).max(20).optional(),
    continueOnError: Joi.boolean().optional()
  }).optional()
}).xor('websiteId', 'websites').unknown(true);

export const deleteWebsiteSchema = Joi.object({
  websiteId: Joi.number().when('websites', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required()
  }),
  // Batch mode properties
  websites: Joi.array().items(
    Joi.object({
      websiteId: Joi.number().required()
    }).unknown(true)
  ).min(1).optional(),
  batchOptions: Joi.object({
    maxConcurrent: Joi.number().min(1).max(20).optional(),
    continueOnError: Joi.boolean().optional()
  }).optional()
}).xor('websiteId', 'websites').unknown(true);

// Website Group validation schemas
export const listWebsiteGroupsSchema = Joi.object({
  filter: Joi.string().optional().description('LogicMonitor query syntax. Available operators: >: (greater than or equals), <: (less than or equals), > (greater than), < (less than), !: (does not equal), : (equals), ~ (includes), !~ (does not include).'),
  size: Joi.number().min(1).max(1000).optional(),
  offset: Joi.number().min(0).optional(),
  fields: Joi.string().optional()
}).unknown(false);

export const getWebsiteGroupSchema = Joi.object({
  groupId: Joi.number().required()
}).unknown(false);

export const createWebsiteGroupSchema = Joi.object({
  // Single group properties
  name: Joi.string().when('groups', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required()
  }),
  parentId: Joi.number().when('groups', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required()
  }),
  description: Joi.string().optional(),
  disableAlerting: Joi.boolean().optional(),
  stopMonitoring: Joi.boolean().optional(),
  properties: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      value: Joi.string().required()
    })
  ).optional(),
  // Batch mode properties
  groups: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      parentId: Joi.number().required(),
      description: Joi.string().optional(),
      disableAlerting: Joi.boolean().optional(),
      stopMonitoring: Joi.boolean().optional(),
      properties: Joi.array().items(
        Joi.object({
          name: Joi.string().required(),
          value: Joi.string().required()
        }).unknown(true)
      ).optional()
    }).unknown(true)
  ).min(1).optional(),
  batchOptions: Joi.object({
    maxConcurrent: Joi.number().min(1).max(20).optional(),
    continueOnError: Joi.boolean().optional()
  }).optional()
}).xor('name', 'groups').unknown(true);

export const updateWebsiteGroupSchema = Joi.object({
  groupId: Joi.number().when('groups', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required()
  }),
  // Single mode properties
  name: Joi.string().optional(),
  description: Joi.string().optional(),
  disableAlerting: Joi.boolean().optional(),
  stopMonitoring: Joi.boolean().optional(),
  properties: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      value: Joi.string().required()
    }).unknown(true)
  ).optional(),
  // Batch mode properties
  groups: Joi.array().items(
    Joi.object({
      groupId: Joi.number().required(),
      name: Joi.string().optional(),
      description: Joi.string().optional(),
      disableAlerting: Joi.boolean().optional(),
      stopMonitoring: Joi.boolean().optional(),
      properties: Joi.array().items(
        Joi.object({
          name: Joi.string().required(),
          value: Joi.string().required()
        }).unknown(true)
      ).optional()
    }).unknown(true)
  ).min(1).optional(),
  batchOptions: Joi.object({
    maxConcurrent: Joi.number().min(1).max(20).optional(),
    continueOnError: Joi.boolean().optional()
  }).optional()
}).xor('groupId', 'groups').unknown(true);

export const deleteWebsiteGroupSchema = Joi.object({
  groupId: Joi.number().when('groups', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required()
  }),
  deleteChildren: Joi.boolean().optional(),
  // Batch mode properties
  groups: Joi.array().items(
    Joi.object({
      groupId: Joi.number().required(),
      deleteChildren: Joi.boolean().optional()
    }).unknown(true)
  ).min(1).optional(),
  batchOptions: Joi.object({
    maxConcurrent: Joi.number().min(1).max(20).optional(),
    continueOnError: Joi.boolean().optional()
  }).optional()
}).xor('groupId', 'groups').unknown(true);
