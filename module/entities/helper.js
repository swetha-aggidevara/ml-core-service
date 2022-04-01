

const entityTypesHelper = require(MODULES_BASE_PATH + "/entityTypes/helper");
const userRolesHelper = require(MODULES_BASE_PATH + "/user-roles/helper");
// const elasticSearch = require(GENERIC_HELPERS_PATH + "/elastic-search");
const sunbirdService = require(ROOT_PATH + '/generics/services/sunbird');
let cache = require(ROOT_PATH+"/generics/helpers/cache");
const formService = require(ROOT_PATH + '/generics/services/form');
module.exports = class EntitiesHelper {


     /**
   * List entity documents.
   * @method
   * @name entityDocuments
   * @param {Object} [findQuery = "all"] - filter query object if not provide 
   * it will load all the document.
   * @param {Array} [fields = "all"] - All the projected field. If not provided
   * returns all the field
   * @param {Number} [limitingValue = ""] - total data to limit.
   * @param {Number} [skippingValue = ""] - total data to skip.
   * @returns {Array} - returns an array of entities data.
   */

  static entityDocuments(
    findQuery = "all", 
    fields = "all",
    skipFields = "none", 
    limitingValue = "", 
    skippingValue = "",
    sortedData = ""
    ) {
        return new Promise(async (resolve, reject) => {
            try {
                
                let queryObject = {};
                
                if (findQuery != "all") {
                    queryObject = findQuery;
                    if( queryObject._id && typeof queryObject._id != "object" && !gen.utils.isValidMongoId(queryObject._id.toString()) ) {
                        queryObject["registryDetails.locationId"] = queryObject._id;
                        delete queryObject._id
                    }
                }
                
                let projectionObject = {};
                
                if (fields != "all") {
                    
                    fields.forEach(element => {
                        projectionObject[element] = 1;
                    });
                }

                if (skipFields != "none") {
                    skipFields.forEach(element => {
                        projectionObject[element] = 0;
                    });
                }
                
                let entitiesDocuments;
                
                if( sortedData !== "" ) {
                    
                    entitiesDocuments = await database.models.entities
                    .find(queryObject, projectionObject)
                    .sort(sortedData)
                    .limit(limitingValue)
                    .skip(skippingValue)
                    .lean();
                } else {
                    
                    entitiesDocuments = await database.models.entities
                    .find(queryObject, projectionObject)
                    .limit(limitingValue)
                    .skip(skippingValue)
                    .lean();
                }
                
                return resolve(entitiesDocuments);
            } catch (error) {
                return reject(error);
            }
        });
    }

     /**
   * Search entity.
   * @method 
   * @name search
   * @param {String} searchText - Text to be search.
   * @param {Number} pageSize - total page size.
   * @param {Number} pageNo - Page no.
   * @param {Array} [entityIds = false] - Array of entity ids.
   */

  static search( searchText, pageSize, pageNo, entityIds = false ) {
    return new Promise(async (resolve, reject) => {
        try {

            let queryObject = {};

            queryObject["$match"] = {};

            if (entityIds && entityIds.length > 0) {
                queryObject["$match"]["_id"] = {};
                queryObject["$match"]["_id"]["$in"] = entityIds;
            }
            
            if( searchText !== "") {
                queryObject["$match"]["$or"] = [
                    { "metaInformation.name": new RegExp(searchText, 'i') },
                    { "metaInformation.externalId": new RegExp("^" + searchText, 'm') },
                    { "metaInformation.addressLine1": new RegExp(searchText, 'i') },
                    { "metaInformation.addressLine2": new RegExp(searchText, 'i') }
                ];
            }

            let entityDocuments = await database.models.entities.aggregate([
                queryObject,
                {
                    $project: {
                        name: "$metaInformation.name",
                        externalId: "$metaInformation.externalId",
                        addressLine1: "$metaInformation.addressLine1",
                        addressLine2: "$metaInformation.addressLine2",
                        entityType : 1
                    }
                },
                {
                    $facet: {
                        "totalCount": [
                            { "$count": "count" }
                        ],
                        "data": [
                            { $skip: pageSize * (pageNo - 1) },
                            { $limit: pageSize }
                        ],
                    }
                }, {
                    $project: {
                        "data": 1,
                        "count": {
                            $arrayElemAt: ["$totalCount.count", 0]
                        }
                    }
                }
            ]);
            
            return resolve(entityDocuments);

        } catch (error) {
            return reject(error);
        }
    })
  }

    /**
     * List all entities based on type.
     * @method
     * @name listByEntityType 
     * @param {String} entityType - entity type
     * @param {Number} pageSize - total page size.
     * @param {Number} pageNo - page number.
     * @param {String} searchText - text to search.
     * @returns {Array} - List of all entities based on type.
     */

    static listByEntityType( entityType,pageSize,pageNo,searchText = "",version = constants.common.VERSION_1 ) {
        return new Promise(async (resolve, reject) => {
            try {


                let queryObject = {
                    $match : {
                        entityType : entityType
                    }
                };
    
                if( searchText !== "") {
                    queryObject["$match"]["$or"] = [
                        { "metaInformation.name": new RegExp(searchText, 'i') },
                        { "metaInformation.externalId": new RegExp("^" + searchText, 'm') },
                        { "metaInformation.addressLine1": new RegExp(searchText, 'i') },
                        { "metaInformation.addressLine2": new RegExp(searchText, 'i') }
                    ];
                }

                let aggregationData = [
                    queryObject,
                    {
                        $project: {
                            name: "$metaInformation.name",
                            externalId: "$metaInformation.externalId",
                            locationId : "$registryDetails.locationId"
                        }
                    }
                ];

                if( version === constants.common.VERSION_2 ) {
                    
                    aggregationData.push({
                        $facet: {
                            "totalCount": [
                                { "$count": "count" }
                            ],
                            "data": [
                                { $skip: pageSize * (pageNo - 1) },
                                { $limit: pageSize }
                            ],
                        }
                    },{
                        $project: {
                            "data": 1,
                            "count": {
                                $arrayElemAt: ["$totalCount.count", 0]
                            }
                        }
                    });
                }
    
                let entityDocuments = 
                await database.models.entities.aggregate(aggregationData);
                
                return resolve({
                    message: constants.apiResponses.ENTITIES_FETCHED,
                    result: entityDocuments
                });

            } catch (error) {
                reject(error);
            }
        })

    }

    /**
    * Get immediate entities.
    * @method
    * @name listByEntityType
    * @param {Object} entityId
    * @returns {Array} - List of all immediateEntities based on entityId.
    */

    static immediateEntities(entityId, searchText = "",pageSize="",pageNo="") {
        return new Promise(async (resolve, reject) => {

            try {
                let bodyData={
                    "parentId" : entityId
                };
                
                let entitiesData = await sunbirdService.learnerLocationSearch(
                    bodyData,
                    pageSize,
                    pageNo,
                    searchText
                );
                
                if( !entitiesData.success || !entitiesData.data || !entitiesData.data.response.length > 0 ) {
                    return resolve({
                        data : entitiesData.data.response,
                        count : entitiesData.data.count
                    }); 
                }
         
                let immediateLocation = entitiesData.data.response;
                

                return resolve({
                    data : immediateLocation,
                    count : entitiesData.data.count
                });


                // if( searchText !== "" ){
                //     let matchEntities = [];
                //     immediateLocation.map( entityData => {
                //         if( entityData.name.match(new RegExp(searchText, 'i')) || entityData.code.match(new RegExp("^" + searchText, 'm')) ) {
                //             matchEntities.push(entityData)
                //         }
                //     });
                //     immediateLocation = [];
                //     immediateLocation = matchEntities;
                // }

                // let formatedEntities = [];

                // immediateLocation.map( entityData => {
                //     let data = {};
                //     data._id = entityData.id;
                //     data.entityType = entityData.type;
                //     data.name = entityData.name;
                //     data.externalId = entityData.code;
                //     data.label = entityData.name;
                //     data.value = entityData.id
                //     formatedEntities.push(data)
                // } );

                // immediateLocation = [];
                // immediateLocation = formatedEntities;

                
                
                
                
                // let projection = [
                //     constants.schema.ENTITYTYPE,
                //     constants.schema.GROUPS
                // ];
    
                // let entitiesDocument = await this.entityDocuments({
                //     _id: entityId
                // }, projection);
    
                // let immediateEntities = [];
    
                // if (entitiesDocument[0] &&
                //     entitiesDocument[0].groups &&
                //     Object.keys(entitiesDocument[0].groups).length > 0
                // ) {
    
                //     let getImmediateEntityTypes =
                //         await entityTypesHelper.entityTypesDocument({
                //             name : entitiesDocument[0].entityType
                //         },["immediateChildrenEntityType"]
                //     );
    
                //     let immediateEntitiesIds;
    
                //     Object.keys(entitiesDocument[0].groups).forEach(entityGroup => {
                //         if (
                //             getImmediateEntityTypes[0].immediateChildrenEntityType &&
                //             getImmediateEntityTypes[0].immediateChildrenEntityType.length > 0 &&
                //             getImmediateEntityTypes[0].immediateChildrenEntityType.includes(entityGroup)
                //         ) {
                //             immediateEntitiesIds = 
                //             entitiesDocument[0].groups[entityGroup];
                //         }
                //     })
                //     console.log("Immediate entities before : ",immediateEntitiesIds)
                //     if (
                //         Array.isArray(immediateEntitiesIds) &&
                //         immediateEntitiesIds.length > 0
                //     ) {
                   
                //         let searchImmediateData = await this.search(
                //             searchText, 
                //             pageSize, 
                //             pageNo, 
                //             immediateEntitiesIds
                //         );
    
                //         immediateEntities = searchImmediateData[0];
                //     }
                // }
                // console.log("immediateEntities : ",immediateEntities)
                // return resolve(immediateEntities);

            } catch(error) {
                return reject(error);
            }
        })
    }

    /**
     * Get immediate entities for requested Array.
     * @method
     * @name subList
     * @param {params} entities - array of entitity ids
     * @param {params} entityId - single entitiy id
     * @param {params} type - sub list entity type. 
     * @param {params} search - search entity data. 
     * @param {params} limit - page limit. 
     * @param {params} pageNo - page no. 
     * @returns {Array} - List of all sub list entities.
     */

    static subEntityList( entities,entityId,type,search,limit,pageNo ) {
        return new Promise(async (resolve, reject) => {

            try {
                
                let result = {};
                let subentitiesResult = {};
                let uniqueEntities = [];
                let obj = {
                    entityId : entityId,
                    type : type,
                    search : search,
                    limit :limit,
                    pageNo : pageNo
                }
                
                if ( entityId !== "" ) {
                    subentitiesResult = await this.subEntities(
                        obj
                    );
                } else {
                        obj["entityId"] = entities;
                        subentitiesResult = await this.subEntities(
                            obj
                        );
                        
                }
                
                
                if ( subentitiesResult && subentitiesResult.data && subentitiesResult.data.length > 0 ) { 
                    let formatedEntities = [];
                    uniqueEntities = subentitiesResult.data
                    uniqueEntities.map( entityData => {
                        let data = {};
                        data._id = entityData.id;
                        data.entityType = entityData.type;
                        data.name = entityData.name;
                        data.externalId = entityData.code;
                        data.label = entityData.name;
                        data.value = entityData.id
                        formatedEntities.push(data)
                    } );
                    uniqueEntities = [];
                    uniqueEntities = formatedEntities;
                }
                
                result.data = uniqueEntities;
                result.count = subentitiesResult.count;
                
                resolve({
                    message: constants.apiResponses.ENTITIES_FETCHED,
                    result: result
                }); 

                //remove when new code  confirmed.
                
                //let totalcount = uniqueEntities.length;
                // if (uniqueEntities.length > 0) {
                //     let startIndex = limit * (pageNo - 1);
                //     let endIndex = startIndex + limit;
                //     uniqueEntities = uniqueEntities.slice(startIndex, endIndex);
                // }
                

                // if ( entityId !== "" ) {
                //     uniqueEntities = await this.subEntities(
                //         obj
                //     );
                // } else {
                //     await Promise.all(entities.map(async (entity)=> {
    
                //         obj["entityId"] = entity;
                //         let entitiesDocument = await this.subEntities(
                //             obj
                //         );
                //         if( Array.isArray(entitiesDocument) && 
                //         entitiesDocument.length > 0
                //         ) {
                //             entitiesDocument.forEach(entityData => {
                //                 aggregateEntitiesData.push(entityData);
                //             });
                //         } 
                //     }));
                //     aggregateEntitiesData.map( data => {
                //         if (uniqueEntities.includes(data) === false) uniqueEntities.push(data);
                //     });
                // }
                // if( result.data && result.data.length > 0 ) {
                //     result.data = result.data.map(data=>{
                //         let cloneData = {...data};
                //         cloneData["label"] = cloneData.name;
                //         cloneData["value"] = cloneData._id;
                //         return cloneData;
                //     })
                // }
    
                  
            } catch(error) {
                return reject(error);
            }
        })
    }

     /**
     * Get either immediate entities or entity traversal based upon the type.
     * @method
     * @name subEntities
     * @param {body} entitiesData
     * @returns {Array} - List of all immediate entities or traversal data.
     */

    static subEntities( entitiesData ) {
        return new Promise(async (resolve, reject) => {
            
            try {
               
                let entitiesDocument;
        
                if( entitiesData.type !== "" ) {
                    
                    entitiesDocument = await this.entityTraversal(
                        entitiesData.entityId,
                        entitiesData.type,
                        entitiesData.search,
                        entitiesData.limit,
                        entitiesData.pageNo
                        );
                } else {
                    entitiesDocument = await this.immediateEntities(
                        entitiesData.entityId, 
                        entitiesData.search,
                        entitiesData.limit,
                        entitiesData.pageNo
                    );
                }
                
                return resolve(entitiesDocument);

                // if( entitiesData.type !== "" ) {
                    
                //     entitiesDocument = await this.entityTraversal(
                //         entitiesData.entityId,
                //         entitiesData.type,
                //         entitiesData.search,
                //         entitiesData.limit,
                //         entitiesData.pageNo
                //         );
                // } else {
                //     console.log("working in else part")
                //     //type is empty call learner search with parentId
                //     entitiesDocument = await this.immediateEntities(
                //         entitiesData.entityId, 
                //         entitiesData.search,
                //         entitiesData.limit,
                //         entitiesData.pageNo
                //     );
                // }
                
                
            } catch(error) {
                return reject(error);
            }
        })
    }

    /**
    * Get immediate entities.
    * @method
    * @name listByEntityType
    * @param {Object} entityId
    * @returns {Array} - List of all immediateEntities based on entityId.
    */

   static entityTraversal(
       entityId,
       entityTraversalType = "", 
       searchText = "",
       pageSize = "",
       pageNo = "",
    ) {
        return new Promise(async (resolve, reject) => {
            try {
        
                if( entityTraversalType == constants.common.SCHOOL) {
                    let filterData = {
                        "orgLocation.id" : entityId
                    }
                    let subentitiesCode = await sunbirdService.schoolData( filterData, pageSize, pageNo, searchText );
                    
                    if( !subentitiesCode.success ||
                        !subentitiesCode.data ||
                        !subentitiesCode.data.response ||
                        !subentitiesCode.data.response.content ||
                        !subentitiesCode.data.response.content.length > 0 ) {
                        return resolve({
                            data : [],
                            count : subentitiesCode.data.response.count
                        }) 
                    }
                    let schoolDetails = subentitiesCode.data.response.content;
                    //get code from all data
                    let schoolCodes = [];
                    schoolDetails.map(schoolData=> {
                        schoolCodes.push(schoolData.externalId);
                    });
                    

                    let bodyData={
                        "code" : schoolCodes
                    };
                    
                
                    let entitiesData = await sunbirdService.learnerLocationSearch( bodyData );
                
                    if( !entitiesData.success || !entitiesData.data || !entitiesData.data.response.length > 0 ) {
                        return resolve({
                            data : [],
                            count : 0
                        }) 
                    }
                    subentitiesData = entitiesData.data.response;
                    return resolve({
                        data : subentitiesData,
                        count : subentitiesCode.data.response.count
                    }) 


                } else {
                    let subEntitiesMatchingType = [];
                    
                    let subEntities = await subEntitiesWithMatchingType( entityId,entityTraversalType,subEntitiesMatchingType )
               
                    if( !subEntities.length > 0 ) {
                        return resolve({
                            data : subEntities,
                            count : 0
                        }) 
                    }
                    
                    let subentitiesData = subEntities
                    let count = subentitiesData.length;
                    if( searchText !== "" ){
                        let matchEntities = [];
                        subentitiesData.map( entityData => {
                            if( entityData.name.match(new RegExp(searchText, 'i')) || entityData.code.match(new RegExp("^" + searchText, 'm')) ) {
                                matchEntities.push(entityData)
                            }
                        });
                        subentitiesData = [];
                        subentitiesData = matchEntities;
                    } 
                    
                    if (subentitiesData.length > 0) {
                        let startIndex = pageSize * (pageNo - 1);
                        let endIndex = startIndex + pageSize;
                        subentitiesData = subentitiesData.slice(startIndex, endIndex);
                    }
                    return resolve({
                        data : subentitiesData,
                        count : count
                    }) 
                
                }
                
                 
                // let formatedEntities = [];

                // subentitiesData.map( entityData => {
                //     let data = {};
                //     data._id = entityData.id;
                //     data.entityType = entityData.type;
                //     data.name = entityData.name;
                //     data.externalId = entityData.code;
                //     data.label = entityData.name;
                //     data.value = entityData.id
                //     formatedEntities.push(data)
                // } );

                // subentitiesData = [];
                // subentitiesData = formatedEntities;

                
                
                // let subEntitiesMatchingType = [];
                // let parentId = [];
                // parentId.push(entityId);
                // let subEntities = await subEntitiesWithMatchingType( parentId,entityTraversalType,subEntitiesMatchingType )
               
                // if( !subEntities.length > 0 ) {
                //     return resolve(subEntities) 
                // }

                // if( searchText !== "" ){
                //     let matchEntities = [];
                //     subEntities.map( entityData => {
                //         if( entityData.name.match(new RegExp(searchText, 'i')) || entityData.code.match(new RegExp("^" + searchText, 'm')) ) {
                //             matchEntities.push(entityData)
                //         }
                //     });
                //     subEntities = [];
                //     subEntities = matchEntities;
                // }

                // let formatedEntities = [];

                // subEntities.map( entityData => {
                //     let data = {};
                //     data._id = entityData.id;
                //     data.entityType = entityData.type;
                //     data.name = entityData.name;
                //     data.externalId = entityData.code;
                //     data.label = entityData.name;
                //     data.value = entityData.id
                //     formatedEntities.push(data)
                // } );

                // subEntities = [];
                // subEntities = formatedEntities;

                // return resolve(subEntities);

                
                
                // let entityTraversal = `groups.${entityTraversalType}`;

                // let entitiesDocument = 
                // await this.entityDocuments(
                //     { 
                //         _id: entityId,
                //         "groups" : { $exists : true }, 
                //         [entityTraversal] : { $exists: true } 
                //     },
                //     [ entityTraversal ]
                // );

                // if( !entitiesDocument[0] ) {
                //     return resolve([]);
                // }

                // let result = [];
                
                // if( entitiesDocument[0].groups[entityTraversalType].length > 0 ) {
                    
                //     let entityTraversalData = await this.search(
                //         searchText,
                //         pageSize,
                //         pageNo,
                //         entitiesDocument[0].groups[entityTraversalType]
                //     );

                //     result = entityTraversalData[0];

                // }

                // return resolve(result);

            } catch(error) {
                return reject(error);
            }
        })
   }

   /**
   * All the related entities for the given entities.
   * @method
   * @name relatedEntities
   * @param {String} entityId - entity id.
   * @param {String} entityTypeId - entity type id.
   * @param {String} entityType - entity type.
   * @param {Array} [projection = "all"] - total fields to be projected.
   * @returns {Array} - returns an array of related entities data.
   */

  static relatedEntities(entityId, entityTypeId, entityType, projection = "all") {
    return new Promise(async (resolve, reject) => {
        try {

            let relatedEntitiesQuery = {};

            if (entityTypeId && entityId && entityType) {
                relatedEntitiesQuery[`groups.${entityType}`] = entityId;
                relatedEntitiesQuery["entityTypeId"] = {};
                relatedEntitiesQuery["entityTypeId"]["$ne"] = entityTypeId;
            } else {
                return resolve({ 
                    status: httpStatusCode.bad_request.status, 
                    message: constants.apiResponses.MISSING_ENTITYID_ENTITYTYPE_ENTITYTYPEID 
                });
            }

            let relatedEntitiesDocument = await this.entityDocuments(relatedEntitiesQuery, projection);
            
            relatedEntitiesDocument = relatedEntitiesDocument ? relatedEntitiesDocument : [];

            return resolve(relatedEntitiesDocument);


        } catch (error) {
            return reject({
                status: error.status || httpStatusCode.internal_server_error.status,
                message: error.message || httpStatusCode.internal_server_error.message
            });
        }
    })
  }

   /**
   * List of Entities
   * @method
   * @name list
   * @param bodyData - Body data.
   * @returns {Array} List of Entities.
   */
  
  static listByEntityIds( entityIds = [], fields = [] ) {
    return new Promise(async (resolve, reject) => {
        try {

            const entities = await this.entityDocuments(
                {
                    _id : { $in : entityIds }
                },
                fields ? fields  : [] 
            );

            return resolve({
                message : constants.apiResponses.ENTITIES_FETCHED,
                result : entities
            });
            
        } catch (error) {
            return reject(error);
        }
    });
  }

     /**
   * Get users by entityId and role
   * @method
   * @name getUsersByEntityAndRole
   * @param {Object} requestedData - requested data.
   * @param {String} entityId - entity id.
   * @param {String} role - role code.
   * @returns {Array}  - List of userIds and entityIds
   */

//   static getUsersByEntityAndRole( entityId= "", role= "" ) {
//     return new Promise(async (resolve, reject) => {
//         try {

//             if (entityId == "") {
//                 throw new Error(constants.apiResponses.ENTITY_ID_REQUIRED);
//             }

//             if (role == "") {
//                 throw new Error(constants.apiResponses.ROLE_REQUIRED)
//             }

//             let userRole = await userRolesHelper.roleDocuments({
//                 code : role
//             },[
//                 "entityTypes"
//             ]);
            
//             if(!userRole.length) {
//                 throw new Error(constants.apiResponses.INVALID_ROLE)
//             }

//             let entityType = userRole[0].entityTypes[0].entityType;

//             let entityTypeOfInputEntityId = await this.entityDocuments
//             (
//                 { _id: entityId },
//                 ["entityType"]
//             )

//             if (entityTypeOfInputEntityId.length == 0) {
//                 throw new Error(constants.apiResponses.ENTITY_NOT_FOUND);
//             }
            
//             let entityDocument = [];
//             let entityIds = [];

//             if (entityType == entityTypeOfInputEntityId[0].entityType) {
//                 entityIds.push(entityId)
//             }
//             else {
//                 entityDocument = await this.entityDocuments
//                     (
//                         {
//                             _id: entityId
//                         },
//                         [
//                             `groups.${entityType}`
//                         ]
//                 )
                
//                 if (entityDocument.length > 0) {
//                     entityIds = entityDocument[0].groups[entityType]
//                 }
//             }

//             if (!entityIds.length) {
//                 throw new Error(constants.apiResponses.USERS_NOT_FOUND);
//             }

//             let chunkOfEntities = _.chunk(entityIds, 1000);

//             let entitiesFromEs = [];

//             for(let entities = 0; entities < chunkOfEntities.length; entities++) {
                
//                 let queryObject = {
//                     "query": {
//                       "ids" : {
//                         "values" : chunkOfEntities[entities]
//                       }
//                     },
//                     "_source":  [`data.roles.${role}`,"data.externalId"]
//                 }

//                 let entityDocuments = await elasticSearch.searchDocumentFromIndex
//                 (
//                     process.env.ELASTICSEARCH_ENTITIES_INDEX,
//                     "_doc",
//                     queryObject,
//                     "all",
//                     1000
//                 )
                
//                 if (entityDocuments && entityDocuments.length > 0) {
//                   entitiesFromEs = [...entitiesFromEs, ...entityDocuments]
//                 }
//             } 

//             if (!entitiesFromEs.length) {
//                 throw new Error(constants.apiResponses.USERS_NOT_FOUND)
//             }
            
//             let result = [];
        
//             for (let entity = 0; entity < entitiesFromEs.length; entity++) {
//                 if (entitiesFromEs[entity].data.roles && Object.keys(entitiesFromEs[entity].data.roles).length > 0) {
//                     for (let user = 0; user < entitiesFromEs[entity].data.roles[role].length; user++) {
//                         result.push({
//                             entityId: entitiesFromEs[entity].id,
//                             entityExternalId: entitiesFromEs[entity].data.externalId ? entitiesFromEs[entity].data.externalId : "",
//                             userId: entitiesFromEs[entity].data.roles[role][user]
//                         })
//                     }
//                 }
//             }
           
//             resolve({
//                 success: true,
//                 message : constants.apiResponses.USERS_AND_ENTITIES_FETCHED,
//                 data : result
//             });

//         } catch (error) {
//             return resolve({
//                 success: false,
//                 message: error.message,
//                 data: false
//             });
//         }
//     })
//   }

    /** 
    * Sub entity type list.
    * @method
    * @name subEntityListBasedOnRoleAndLocation
    * @param role - role code
    * @param stateLocationId - state location id.
    * @returns {Array} List of sub entity type.
    */

    static subEntityListBasedOnRoleAndLocation( stateLocationId,role ) {   
        return new Promise(async (resolve, reject) => {
            try {
                let entityKey = constants.common.SUBENTITY + stateLocationId;
                
                let rolesDocument = await userRolesHelper.roleDocuments({
                    code : role
                },["entityTypes.entityType"]);
                
                if( !rolesDocument.length > 0 ) {
                    throw {
                        status : httpStatusCode["bad_request"].status,
                        message: constants.apiResponses.USER_ROLES_NOT_FOUND
                    }
                }
                
                let subEntities = await cache.getValue(entityKey);
               
                if( !subEntities.length > 0 ) {
                    let bodyData={
                        "id" : stateLocationId
                    };
                    
                    let entitiesData = await sunbirdService.learnerLocationSearch( bodyData );

                    if( !entitiesData.success || !entitiesData.data || !entitiesData.data.response.length > 0 ) {
                        return resolve({
                            message : constants.apiResponses.ENTITY_NOT_FOUND,
                            result : []
                        })
                    }
                    
                    let stateLocationCode = entitiesData.data.response[0].code;
                    subEntities = await formService.formData( stateLocationCode,entityKey );
                    if( !subEntities.length > 0 ) {
                        return resolve({
                            message : constants.apiResponses.ENTITY_NOT_FOUND,
                            result : []
                        })
                    }
                }
                
               
                let result = [];

                if( rolesDocument[0].entityTypes[0].entityType === constants.common.STATE_ENTITY_TYPE ) {
                    result = subEntities;
                    result.unshift(constants.common.STATE_ENTITY_TYPE);
                } else {

                    let targetedEntityType = "";

                    rolesDocument[0].entityTypes.forEach(singleEntityType => {
                       if( subEntities.includes(singleEntityType.entityType) ) {
                           targetedEntityType = singleEntityType.entityType;
                       }
                    });
   
                    let findTargetedEntityIndex = 
                    subEntities.findIndex(element => element === targetedEntityType);
                    if( findTargetedEntityIndex < 0 ) {
                       throw {
                           message : constants.apiResponses.SUB_ENTITY_NOT_FOUND,
                           result : []
                       }
                    }
   
                    result = subEntities.slice(findTargetedEntityIndex);
                }
                 
                return resolve({
                    success: true,
                    message : constants.apiResponses.ENTITIES_CHILD_HIERACHY_PATH,
                    result : result
                });
    
            } catch (error) {
                return reject(error);
            }
        })
    
       }

    /**
         * Entity details information.
         * @method 
         * @name details
         * @param {String} entityId - _id of entity.
         * @param {Object} requestData -  query details.
         * @param {String} requestData.locationIds -  array of location Ids
         * @param {String} requestData.entityIds -  array of entity Ids
         * @return {Array} - consists of entity details information. 
    */

    static details(entityId, requestData = {}) {
        return new Promise(async (resolve, reject) => {
            try {

                let entityIds = [];
                let query = {};
                query["$or"] = [];

                if (entityId) {
                    entityIds.push(entityId)
                }
                if (requestData && requestData.entityIds) {
                    entityIds.push(...requestData.entityIds);
                }
                if(entityIds.length == 0 && !requestData.locationIds && !requestData.codes){
                    throw {
                        message : constants.apiResponses.ENTITY_ID_OR_LOCATION_ID_NOT_FOUND,
                    }
                }

                if (entityIds.length > 0) {
                    query["$or"].push({
                        _id: {
                            $in: entityIds
                        }
                    })
                }

                if (requestData && requestData.locationIds) {
                    query["$or"].push({
                        "registryDetails.locationId": {
                            $in: requestData.locationIds
                        }
                    })
                }
                if (requestData && requestData.codes) {
                    query["$or"].push({
                        "registryDetails.code": {
                            $in: requestData.codes
                        }
                    })
                }

            let entityDocument = await this.entityDocuments(
                query,
                "all",
                ["groups"]
            );

            if (entityDocument && entityDocument.length ==0 ) {
                return resolve({
                    status : httpStatusCode.bad_request.status,
                    message : constants.apiResponses.ENTITY_NOT_FOUND
                })
            }

            resolve({
                message : constants.apiResponses.ENTITY_INFORMATION_FETCHED,
                result : entityDocument
            });

        } catch (error) {
            return reject(error);
        }
    })
  }

}

// /**
//   * get subEntities of matching type by recursion.
//   * @method
//   * @name subEntitiesWithMatchingType
//   * @returns {Array} - Sub entities matching the type .
//   */

async function subEntitiesWithMatchingType( parentIds,entityType,matchingData ){
    
    if( !parentIds.length > 0 ){
      return matchingData;
    }

    let bodyData={
        "parentId" : parentIds
    };
    
    let entityDetails = await sunbirdService.learnerLocationSearch(bodyData);

    if( ( !entityDetails.success || !entityDetails.data || !entityDetails.data.response.length > 0 ) && !matchingData.length > 0 ) {
      return matchingData;
    }
    
    let entityData = entityDetails.data.response;
    
   
    let mismatchEntities = [];
    entityData.map(entity => {
      
      if( entity.type == entityType ) {
        matchingData.push(entity)
       
      } else {
        mismatchEntities.push(entity.id)
      }
    });

    if( mismatchEntities.length > 0 ){
      
      await subEntitiesWithMatchingType(mismatchEntities,entityType,matchingData)
    } 
    let uniqueEntities = [];
    matchingData.map( data => {
      if (uniqueEntities.includes(data) === false) uniqueEntities.push(data);
    });
    return uniqueEntities;
  
    
  
   }