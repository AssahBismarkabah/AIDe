// Mock implementation of java-parser for Jest tests
module.exports = {
  parse: jest.fn(() => ({
    children: {
      compilationUnit: [{
        children: {
          packageDeclaration: [{
            children: {
              qualifiedName: [{
                children: {
                  identifier: [{ image: 'com.example' }]
                }
              }]
            },
            location: { startLine: 1 }
          }],
          importDeclaration: [{
            children: {
              qualifiedName: [{
                children: {
                  identifier: [{ image: 'java.util.List' }]
                }
              }]
            },
            location: { startLine: 3 }
          }],
          typeDeclaration: [{
            children: {
              classDeclaration: [{
                children: {
                  normalClassDeclaration: [{
                    children: {
                      typeIdentifier: [{ image: 'TestClass' }],
                      classBody: [{
                        children: {
                          classBodyDeclaration: [{
                            children: {
                              classMemberDeclaration: [{
                                children: {
                                  methodDeclaration: [{
                                    children: {
                                      methodHeader: [{
                                        children: {
                                          methodDeclarator: [{
                                            children: {
                                              identifier: [{ image: 'testMethod' }]
                                            }
                                          }],
                                          result: [{
                                            children: {
                                              unannType: [{
                                                children: {
                                                  primitiveType: [{
                                                    children: { Int: true }
                                                  }]
                                                }
                                              }]
                                            }
                                          }]
                                        }
                                      }],
                                      methodBody: [{
                                        children: {
                                          block: [{
                                            children: {
                                              blockStatements: [{
                                                children: {
                                                  blockStatement: [{
                                                    children: {
                                                      statement: [{
                                                        children: {
                                                          returnStatement: [{}]
                                                        }
                                                      }]
                                                    }
                                                  }]
                                                }
                                              }]
                                            }
                                          }]
                                        }
                                      }]
                                    },
                                    location: { startLine: 5, endLine: 7 }
                                  }]
                                }
                              }]
                            }
                          }]
                        }
                      }]
                    }
                  }]
                },
                location: { startLine: 4, endLine: 8 }
              }]
            }
          }]
        }
      }]
    }
  }))
};