/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for
 * license information.
 *
 * Code generated by Microsoft (R) AutoRest Code Generator.
 * Changes may cause incorrect behavior and will be lost if the code is
 * regenerated.
 */

import * as msRest from "@azure/ms-rest-js";
import * as Models from "../models";
import * as Mappers from "../models/vfsMappers";
import * as Parameters from "../models/parameters";
import { KuduClientContext } from "../kuduClientContext";

/** Class representing a Vfs. */
export class Vfs {
  private readonly client: KuduClientContext;

  /**
   * Create a Vfs.
   * @param {KuduClientContext} client Reference to the service client.
   */
  constructor(client: KuduClientContext) {
    this.client = client;
  }

  /**
   * @param path
   * @param [options] The optional parameters
   * @returns Promise<msRest.RestResponse>
   */
  getItem(path: string, options?: msRest.RequestOptionsBase): Promise<msRest.RestResponse>;
  /**
   * @param path
   * @param callback The callback
   */
  getItem(path: string, callback: msRest.ServiceCallback<void>): void;
  /**
   * @param path
   * @param options The optional parameters
   * @param callback The callback
   */
  getItem(path: string, options: msRest.RequestOptionsBase, callback: msRest.ServiceCallback<void>): void;
  getItem(path: string, options?: msRest.RequestOptionsBase | msRest.ServiceCallback<void>, callback?: msRest.ServiceCallback<void>): Promise<msRest.RestResponse> {
    return this.client.sendOperationRequest(
      {
        path,
        options
      },
      getItemOperationSpec,
      callback);
  }

  /**
   * @param file
   * @param path
   * @param [options] The optional parameters
   * @returns Promise<Models.VfsPutItemResponse>
   */
  putItem(file: msRest.HttpRequestBody, path: string, options?: msRest.RequestOptionsBase): Promise<Models.VfsPutItemResponse>;
  /**
   * @param file
   * @param path
   * @param callback The callback
   */
  putItem(file: msRest.HttpRequestBody, path: string, callback: msRest.ServiceCallback<any>): void;
  /**
   * @param file
   * @param path
   * @param options The optional parameters
   * @param callback The callback
   */
  putItem(file: msRest.HttpRequestBody, path: string, options: msRest.RequestOptionsBase, callback: msRest.ServiceCallback<any>): void;
  putItem(file: msRest.HttpRequestBody, path: string, options?: msRest.RequestOptionsBase | msRest.ServiceCallback<any>, callback?: msRest.ServiceCallback<any>): Promise<Models.VfsPutItemResponse> {
    return this.client.sendOperationRequest(
      {
        file,
        path,
        options
      },
      putItemOperationSpec,
      callback) as Promise<Models.VfsPutItemResponse>;
  }

  /**
   * @param path
   * @param [options] The optional parameters
   * @returns Promise<Models.VfsDeleteItemResponse>
   */
  deleteItem(path: string, options?: Models.VfsDeleteItemOptionalParams): Promise<Models.VfsDeleteItemResponse>;
  /**
   * @param path
   * @param callback The callback
   */
  deleteItem(path: string, callback: msRest.ServiceCallback<any>): void;
  /**
   * @param path
   * @param options The optional parameters
   * @param callback The callback
   */
  deleteItem(path: string, options: Models.VfsDeleteItemOptionalParams, callback: msRest.ServiceCallback<any>): void;
  deleteItem(path: string, options?: Models.VfsDeleteItemOptionalParams | msRest.ServiceCallback<any>, callback?: msRest.ServiceCallback<any>): Promise<Models.VfsDeleteItemResponse> {
    return this.client.sendOperationRequest(
      {
        path,
        options
      },
      deleteItemOperationSpec,
      callback) as Promise<Models.VfsDeleteItemResponse>;
  }

  /**
   * @param path
   * @param [options] The optional parameters
   * @returns Promise<msRest.RestResponse>
   */
  getItem1(path: string, options?: msRest.RequestOptionsBase): Promise<msRest.RestResponse>;
  /**
   * @param path
   * @param callback The callback
   */
  getItem1(path: string, callback: msRest.ServiceCallback<void>): void;
  /**
   * @param path
   * @param options The optional parameters
   * @param callback The callback
   */
  getItem1(path: string, options: msRest.RequestOptionsBase, callback: msRest.ServiceCallback<void>): void;
  getItem1(path: string, options?: msRest.RequestOptionsBase | msRest.ServiceCallback<void>, callback?: msRest.ServiceCallback<void>): Promise<msRest.RestResponse> {
    return this.client.sendOperationRequest(
      {
        path,
        options
      },
      getItem1OperationSpec,
      callback);
  }

  /**
   * @param path
   * @param [options] The optional parameters
   * @returns Promise<msRest.RestResponse>
   */
  getItem2(path: string, options?: msRest.RequestOptionsBase): Promise<msRest.RestResponse>;
  /**
   * @param path
   * @param callback The callback
   */
  getItem2(path: string, callback: msRest.ServiceCallback<void>): void;
  /**
   * @param path
   * @param options The optional parameters
   * @param callback The callback
   */
  getItem2(path: string, options: msRest.RequestOptionsBase, callback: msRest.ServiceCallback<void>): void;
  getItem2(path: string, options?: msRest.RequestOptionsBase | msRest.ServiceCallback<void>, callback?: msRest.ServiceCallback<void>): Promise<msRest.RestResponse> {
    return this.client.sendOperationRequest(
      {
        path,
        options
      },
      getItem2OperationSpec,
      callback);
  }

  /**
   * @param file
   * @param path
   * @param [options] The optional parameters
   * @returns Promise<Models.VfsPutItem1Response>
   */
  putItem1(file: msRest.HttpRequestBody, path: string, options?: msRest.RequestOptionsBase): Promise<Models.VfsPutItem1Response>;
  /**
   * @param file
   * @param path
   * @param callback The callback
   */
  putItem1(file: msRest.HttpRequestBody, path: string, callback: msRest.ServiceCallback<any>): void;
  /**
   * @param file
   * @param path
   * @param options The optional parameters
   * @param callback The callback
   */
  putItem1(file: msRest.HttpRequestBody, path: string, options: msRest.RequestOptionsBase, callback: msRest.ServiceCallback<any>): void;
  putItem1(file: msRest.HttpRequestBody, path: string, options?: msRest.RequestOptionsBase | msRest.ServiceCallback<any>, callback?: msRest.ServiceCallback<any>): Promise<Models.VfsPutItem1Response> {
    return this.client.sendOperationRequest(
      {
        file,
        path,
        options
      },
      putItem1OperationSpec,
      callback) as Promise<Models.VfsPutItem1Response>;
  }

  /**
   * @param path
   * @param [options] The optional parameters
   * @returns Promise<Models.VfsDeleteItem1Response>
   */
  deleteItem1(path: string, options?: Models.VfsDeleteItem1OptionalParams): Promise<Models.VfsDeleteItem1Response>;
  /**
   * @param path
   * @param callback The callback
   */
  deleteItem1(path: string, callback: msRest.ServiceCallback<any>): void;
  /**
   * @param path
   * @param options The optional parameters
   * @param callback The callback
   */
  deleteItem1(path: string, options: Models.VfsDeleteItem1OptionalParams, callback: msRest.ServiceCallback<any>): void;
  deleteItem1(path: string, options?: Models.VfsDeleteItem1OptionalParams | msRest.ServiceCallback<any>, callback?: msRest.ServiceCallback<any>): Promise<Models.VfsDeleteItem1Response> {
    return this.client.sendOperationRequest(
      {
        path,
        options
      },
      deleteItem1OperationSpec,
      callback) as Promise<Models.VfsDeleteItem1Response>;
  }

  /**
   * @param path
   * @param [options] The optional parameters
   * @returns Promise<msRest.RestResponse>
   */
  getItem3(path: string, options?: msRest.RequestOptionsBase): Promise<msRest.RestResponse>;
  /**
   * @param path
   * @param callback The callback
   */
  getItem3(path: string, callback: msRest.ServiceCallback<void>): void;
  /**
   * @param path
   * @param options The optional parameters
   * @param callback The callback
   */
  getItem3(path: string, options: msRest.RequestOptionsBase, callback: msRest.ServiceCallback<void>): void;
  getItem3(path: string, options?: msRest.RequestOptionsBase | msRest.ServiceCallback<void>, callback?: msRest.ServiceCallback<void>): Promise<msRest.RestResponse> {
    return this.client.sendOperationRequest(
      {
        path,
        options
      },
      getItem3OperationSpec,
      callback);
  }
}

// Operation Specifications
const serializer = new msRest.Serializer(Mappers);
const getItemOperationSpec: msRest.OperationSpec = {
  httpMethod: "GET",
  path: "vfs/{path}",
  urlParameters: [
    Parameters.path
  ],
  responses: {
    200: {},
    307: {},
    default: {}
  },
  serializer
};

const putItemOperationSpec: msRest.OperationSpec = {
  httpMethod: "PUT",
  path: "vfs/{path}",
  urlParameters: [
    Parameters.path
  ],
  requestBody: {
    parameterPath: "file",
    mapper: {
      required: true,
      serializedName: "file",
      type: {
        name: "Stream"
      }
    }
  },
  contentType: "application/octet-stream",
  responses: {
    200: {
      bodyMapper: {
        serializedName: "parsedResponse",
        type: {
          name: "Object"
        }
      }
    },
    201: {
      bodyMapper: {
        serializedName: "parsedResponse",
        type: {
          name: "Object"
        }
      }
    },
    204: {
      bodyMapper: {
        serializedName: "parsedResponse",
        type: {
          name: "Object"
        }
      }
    },
    default: {}
  },
  serializer
};

const deleteItemOperationSpec: msRest.OperationSpec = {
  httpMethod: "DELETE",
  path: "vfs/{path}",
  urlParameters: [
    Parameters.path
  ],
  queryParameters: [
    Parameters.recursive
  ],
  responses: {
    200: {
      bodyMapper: {
        serializedName: "parsedResponse",
        type: {
          name: "Object"
        }
      }
    },
    default: {}
  },
  serializer
};

const getItem1OperationSpec: msRest.OperationSpec = {
  httpMethod: "HEAD",
  path: "vfs/{path}",
  urlParameters: [
    Parameters.path
  ],
  responses: {
    200: {},
    default: {}
  },
  serializer
};

const getItem2OperationSpec: msRest.OperationSpec = {
  httpMethod: "GET",
  path: "api/vfs/{path}",
  urlParameters: [
    Parameters.path
  ],
  responses: {
    200: {},
    307: {},
    default: {}
  },
  serializer
};

const putItem1OperationSpec: msRest.OperationSpec = {
  httpMethod: "PUT",
  path: "api/vfs/{path}",
  urlParameters: [
    Parameters.path
  ],
  requestBody: {
    parameterPath: "file",
    mapper: {
      required: true,
      serializedName: "file",
      type: {
        name: "Stream"
      }
    }
  },
  contentType: "application/octet-stream",
  responses: {
    200: {
      bodyMapper: {
        serializedName: "parsedResponse",
        type: {
          name: "Object"
        }
      }
    },
    201: {
      bodyMapper: {
        serializedName: "parsedResponse",
        type: {
          name: "Object"
        }
      }
    },
    204: {
      bodyMapper: {
        serializedName: "parsedResponse",
        type: {
          name: "Object"
        }
      }
    },
    default: {}
  },
  serializer
};

const deleteItem1OperationSpec: msRest.OperationSpec = {
  httpMethod: "DELETE",
  path: "api/vfs/{path}",
  urlParameters: [
    Parameters.path
  ],
  queryParameters: [
    Parameters.recursive
  ],
  responses: {
    200: {
      bodyMapper: {
        serializedName: "parsedResponse",
        type: {
          name: "Object"
        }
      }
    },
    default: {}
  },
  serializer
};

const getItem3OperationSpec: msRest.OperationSpec = {
  httpMethod: "HEAD",
  path: "api/vfs/{path}",
  urlParameters: [
    Parameters.path
  ],
  responses: {
    200: {},
    default: {}
  },
  serializer
};
