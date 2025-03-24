// 선택된 노드 안의 디자인이 오토 레이아웃을 활용한 Responsive Design을 잘 적용하고 있는지 검사하는 플러그인
figma.showUI(__html__, { width: 400, height: 560 });

// 오토 레이아웃 적용 상태를 확인하는 함수
function checkAutoLayout(node: SceneNode): any {
  let issues: any[] = [];
  
  // FRAME, COMPONENT, INSTANCE, COMPONENT_SET에만 오토 레이아웃 적용 가능
  if (
    node.type === 'FRAME' || 
    node.type === 'COMPONENT' || 
    node.type === 'INSTANCE' || 
    node.type === 'COMPONENT_SET'
  ) {
    const frameNode = node as FrameNode | ComponentNode | InstanceNode | ComponentSetNode;
    
    // 오토 레이아웃이 적용되지 않은 경우
    if (frameNode.layoutMode === 'NONE') {
      issues.push({
        type: 'NO_AUTO_LAYOUT',
        message: '오토 레이아웃이 적용되지 않았습니다. 반응형 디자인을 위해 오토 레이아웃을 적용하세요.'
      });
    } else {
      // 오토 레이아웃은 적용되어 있지만 추가 검사
      
      // 1. 고정 크기 사용 여부 확인
      if (frameNode.primaryAxisSizingMode === 'FIXED') {
        issues.push({
          type: 'FIXED_PRIMARY_AXIS',
          message: '주 축(Primary Axis)이 고정 크기로 설정되어 있습니다. 반응형을 위해 "Hug contents" 또는 "Fill container"로 변경하세요.'
        });
      }
      
      if (frameNode.counterAxisSizingMode === 'FIXED') {
        issues.push({
          type: 'FIXED_COUNTER_AXIS',
          message: '보조 축(Counter Axis)이 고정 크기로 설정되어 있습니다. 반응형을 위해 "Hug contents" 또는 "Fill container"로 변경하세요.'
        });
      }
      
      // 2. 아이템 간격 확인 (비율이 아닌 고정값인 경우)
      if (frameNode.itemSpacing !== undefined && frameNode.itemSpacing > 0) {
        issues.push({
          type: 'FIXED_ITEM_SPACING',
          message: '아이템 간격이 고정 값으로 설정되어 있습니다.',
          value: frameNode.itemSpacing
        });
      }

      // 3. 패딩 확인
      const padding = [
        frameNode.paddingTop,
        frameNode.paddingRight,
        frameNode.paddingBottom,
        frameNode.paddingLeft
      ];
      
      // 패딩이 0이 아닌데 모든 패딩이 동일하지 않은 경우
      if (padding.some(p => p !== undefined && p > 0) && 
          !padding.every(p => p === padding[0])) {
        issues.push({
          type: 'ASYMMETRIC_PADDING',
          message: '비대칭적인 패딩이 적용되어 있습니다.',
          values: {
            top: frameNode.paddingTop,
            right: frameNode.paddingRight,
            bottom: frameNode.paddingBottom,
            left: frameNode.paddingLeft
          }
        });
      }
    }
  }
  
  // GROUP은 오토 레이아웃을 지원하지 않으므로 이슈로 표시
  if (node.type === 'GROUP' && 'children' in node && node.children.length > 1) {
    issues.push({
      type: 'GROUP_NOT_FRAME',
      message: '그룹 대신 프레임과 오토 레이아웃을 사용하세요. 그룹은 반응형 디자인을 지원하지 않습니다.'
    });
  }
  
  // 반응형 제약 조건 확인 (ABSOLUTE은 반응형에 적합하지 않음)
  if ('constraints' in node) {
    const constraints = node.constraints;
    
    if (constraints.horizontal === 'SCALE' || constraints.vertical === 'SCALE') {
      issues.push({
        type: 'SCALE_CONSTRAINT',
        message: 'SCALE 제약 조건보다 LEFT/RIGHT 또는 TOP/BOTTOM 조합이 더 나은 반응형 동작을 제공합니다.',
        values: {
          horizontal: constraints.horizontal,
          vertical: constraints.vertical
        }
      });
    }
    
    if (constraints.horizontal === 'CENTER' || constraints.vertical === 'CENTER') {
      issues.push({
        type: 'CENTER_CONSTRAINT',
        message: 'CENTER 제약 조건은 화면 크기가 변할 때 예상치 못한 레이아웃이 발생할 수 있습니다.',
        values: {
          horizontal: constraints.horizontal,
          vertical: constraints.vertical
        }
      });
    }
  }
  
  // 고정된 위치(Absolute position) 확인
  if ('parent' in node && node.parent && 
      ('layoutMode' in node.parent) && 
      node.parent.layoutMode !== 'NONE') {
    
    if ('layoutPositioning' in node && node.layoutPositioning === 'ABSOLUTE') {
      issues.push({
        type: 'ABSOLUTE_POSITION',
        message: '오토 레이아웃 내에서 절대 위치가 사용되었습니다. 반응형을 위해 상대적 배치를 사용하세요.'
      });
    }
  }

  return {
    id: node.id,
    name: node.name,
    type: node.type,
    issues: issues,
    hasIssues: issues.length > 0
  };
}

// 노드 및 그 자식 노드들을 재귀적으로 검사하는 함수
function traverseNodes(node: SceneNode, results: any[] = [], excludeHidden: boolean = false) {
  // 숨겨진 노드 건너뛰기
  if (excludeHidden && !node.visible) {
    return results;
  }
  
  // 현재 노드 검사
  const checkResult = checkAutoLayout(node);
  if (checkResult.hasIssues) {
    results.push(checkResult);
  }
  
  // 자식 노드가 있는 경우 재귀적으로 검사
  if ('children' in node) {
    const container = node as ChildrenMixin & SceneNode;
    for (const child of container.children) {
      traverseNodes(child as SceneNode, results, excludeHidden);
    }
  }
  
  return results;
}

// 선택한 노드만 검사하는 함수
function checkSelectedNodes(excludeHidden: boolean = false): any[] {
  const selectedNodes = figma.currentPage.selection;
  
  if (selectedNodes.length === 0) {
    return [];
  }
  
  let results: any[] = [];
  
  // 선택된 각 노드와 그 하위 노드들을 검사
  selectedNodes.forEach(node => {
    results = traverseNodes(node, results, excludeHidden);
  });
  
  return results;
}

// 노드 복제 및 자동 수정 함수
async function cloneAndFixNodes(results: any[]): Promise<{ clonedNodeIds: string[], fixedIssueCount: number }> {
  const clonedNodeIds: string[] = [];
  let fixedIssueCount = 0;
  
  // 결과에서 가장 상위 노드 ID만 추출 (중복 복제 방지)
  const topLevelNodes = new Map<string, SceneNode>();
  
  // 먼저 결과에 포함된 모든 노드를 가져옴
  for (const result of results) {
    const node = figma.getNodeById(result.id) as SceneNode;
    if (!node) continue;
    
    // 이미 포함된 노드의 자식인지 확인
    let isChildOfIncluded = false;
    let parent = node.parent;
    
    while (parent) {
      if (topLevelNodes.has(parent.id)) {
        isChildOfIncluded = true;
        break;
      }
      parent = parent.parent;
    }
    
    // 자식이 아니면 상위 노드로 추가
    if (!isChildOfIncluded) {
      topLevelNodes.set(node.id, node);
    }
  }
  
  // 각 상위 노드에 대해 복제 및 수정 실행
  for (const [nodeId, node] of topLevelNodes.entries()) {
    try {
      // 노드 복제 (SceneNode 타입에 clone 메소드가 있는 경우에만)
      if ('clone' in node) {
        const clone = node.clone();
        
        // 복제된 노드의 크기와 위치 조정
        if ('x' in node && 'y' in node && 'x' in clone && 'y' in clone && 'width' in node) {
          // 원본 노드의 크기와 위치 정보 저장
          const originalWidth = node.width;
          const originalHeight = node.height;
          const originalX = node.x;
          const originalY = node.y;
          
          // 복제된 노드를 원본 옆에 배치
          clone.x = originalX + originalWidth + 50; // 50px 간격
          clone.y = originalY;
          
          // 복제된 노드의 크기를 원본과 동일하게 설정
          if ('resize' in clone) {
            clone.resize(originalWidth, originalHeight);
          }
        }
        
        // 노드 이름 변경
        clone.name = `${node.name} (AutoFixed)`;
        
        // 상위 프레임이나 페이지에 추가
        if (node.parent) {
          node.parent.appendChild(clone);
        }
        
        // 복제된 노드 ID 저장
        clonedNodeIds.push(clone.id);
        
        // 복제된 노드 및 하위 노드 수정
        const fixedCount = await applyAutoFixes(clone);
        fixedIssueCount += fixedCount;
      } else {
        console.warn(`노드 타입 ${node.type}은 복제를 지원하지 않습니다.`);
      }
    } catch (error) {
      console.error('노드 복제 중 오류:', error);
    }
  }
  
  return { clonedNodeIds, fixedIssueCount };
}

// 자동 수정 적용 함수
async function applyAutoFixes(node: SceneNode): Promise<number> {
  let fixedCount = 0;
  
  // 1. 현재 노드 수정
  if (
    (node.type === 'FRAME' || 
    node.type === 'COMPONENT' || 
    node.type === 'INSTANCE' || 
    node.type === 'COMPONENT_SET')
  ) {
    const frameNode = node as FrameNode | ComponentNode | InstanceNode | ComponentSetNode;
    
    // 오토 레이아웃이 없는 경우 적용 (프레임만 가능)
    if (node.type === 'FRAME' && frameNode.layoutMode === 'NONE') {
      (node as FrameNode).layoutMode = 'VERTICAL';
      (node as FrameNode).primaryAxisSizingMode = 'AUTO';
      (node as FrameNode).counterAxisSizingMode = 'AUTO';
      fixedCount++;
    } 
    // 오토 레이아웃이 이미 있는 경우, 사이징 모드 수정
    else if (frameNode.layoutMode !== 'NONE') {
      // 고정 축 수정
      if (frameNode.primaryAxisSizingMode === 'FIXED') {
        frameNode.primaryAxisSizingMode = 'AUTO';
        fixedCount++;
      }
      
      if (frameNode.counterAxisSizingMode === 'FIXED') {
        frameNode.counterAxisSizingMode = 'AUTO';
        fixedCount++;
      }
      
      // 비대칭 패딩 고르게 조정
      const padding = [
        frameNode.paddingTop,
        frameNode.paddingRight,
        frameNode.paddingBottom,
        frameNode.paddingLeft
      ];
      
      if (padding.some(p => p !== undefined && p > 0) && 
          !padding.every(p => p === padding[0])) {
        // 평균 패딩값 계산
        const validPadding = padding.filter(p => p !== undefined && p > 0);
        const avgPadding = validPadding.length > 0 
          ? Math.round(validPadding.reduce((sum, p) => sum + (p || 0), 0) / validPadding.length) 
          : 0;
        
        frameNode.paddingTop = avgPadding;
        frameNode.paddingRight = avgPadding;
        frameNode.paddingBottom = avgPadding;
        frameNode.paddingLeft = avgPadding;
        fixedCount++;
      }
      
      // 아이템 간격 조정
      if (frameNode.itemSpacing !== undefined && frameNode.itemSpacing > 0) {
        frameNode.itemSpacing = 0; // 기본값으로 설정
        fixedCount++;
      }
    }
  }
  
  // 그룹을 프레임으로 변환
  if (node.type === 'GROUP' && 'children' in node && node.children.length > 0) {
    try {
      // 새 프레임 생성
      const newFrame = figma.createFrame();
      newFrame.name = node.name;
      newFrame.layoutMode = 'VERTICAL';
      newFrame.primaryAxisSizingMode = 'AUTO';
      newFrame.counterAxisSizingMode = 'AUTO';
      newFrame.x = node.x;
      newFrame.y = node.y;
      newFrame.resize(node.width, node.height);
      
      // 그룹의 모든 자식을 새 프레임으로 이동
      while (node.children.length > 0) {
        const child = node.children[0];
        newFrame.appendChild(child);
      }
      
      // 그룹을 새 프레임으로 대체
      if (node.parent) {
        const index = node.parent.children.indexOf(node);
        if (index !== -1) {
          node.parent.insertChild(index, newFrame);
          node.remove();
          fixedCount++;
        }
      }
    } catch (error) {
      console.error('그룹을 프레임으로 변환 중 오류:', error);
    }
  }
  
  // 제약 조건 수정
  if ('constraints' in node) {
    const constraints = node.constraints;
    
    // SCALE 제약 조건 수정
    if (constraints.horizontal === 'SCALE') {
      node.constraints = {
        horizontal: 'STRETCH',
        vertical: constraints.vertical
      };
      fixedCount++;
    }
    
    if (constraints.vertical === 'SCALE') {
      node.constraints = {
        horizontal: constraints.horizontal,
        vertical: 'STRETCH'
      };
      fixedCount++;
    }
    
    // CENTER 제약 조건 수정
    if (constraints.horizontal === 'CENTER') {
      node.constraints = {
        horizontal: 'STRETCH',
        vertical: constraints.vertical
      };
      fixedCount++;
    }
    
    if (constraints.vertical === 'CENTER') {
      node.constraints = {
        horizontal: constraints.horizontal,
        vertical: 'STRETCH'
      };
      fixedCount++;
    }
  }
  
  // 레이아웃 포지셔닝 수정 (절대 위치에서 상대 위치로)
  if ('layoutPositioning' in node && node.layoutPositioning === 'ABSOLUTE') {
    node.layoutPositioning = 'AUTO';
    fixedCount++;
  }
  
  // 2. 자식 노드에 대해서도 수정 적용
  if ('children' in node) {
    const container = node as ChildrenMixin & SceneNode;
    for (const child of container.children) {
      const childFixedCount = await applyAutoFixes(child as SceneNode);
      fixedCount += childFixedCount;
    }
  }
  
  return fixedCount;
}

// 메시지 핸들러 설정
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'check-auto-layout') {
    // 옵션 값 가져오기
    const excludeHidden = msg.excludeHidden || false;
    
    // 선택한 노드 검사
    const results = checkSelectedNodes(excludeHidden);
    
    // 선택된 노드가 없는 경우 알림
    if (figma.currentPage.selection.length === 0) {
      figma.ui.postMessage({
        type: 'no-selection',
        message: '선택한 노드가 없습니다. 먼저 노드를 선택하세요.'
      });
      return;
    }
    
    // UI에 결과 전송
    figma.ui.postMessage({
      type: 'auto-layout-results',
      results: results
    });
  }
  
  else if (msg.type === 'clone-and-fix') {
    const excludeHidden = msg.excludeHidden || false;
    
    // 먼저 검사 결과 얻기
    const results = checkSelectedNodes(excludeHidden);
    
    // 선택된 노드가 없거나 이슈가 없는 경우
    if (figma.currentPage.selection.length === 0) {
      figma.ui.postMessage({
        type: 'no-selection',
        message: '선택한 노드가 없습니다. 먼저 노드를 선택하세요.'
      });
      return;
    }
    
    if (results.length === 0) {
      figma.ui.postMessage({
        type: 'no-issues',
        message: '자동 수정할 이슈가 없습니다. 모든 항목이 이미 최적화되어 있습니다.'
      });
      return;
    }
    
    // 진행 상태 전송
    figma.ui.postMessage({
      type: 'fix-started',
      message: '노드를 복제하고 자동 수정 중...'
    });
    
    try {
      // 노드 복제 및 수정
      const { clonedNodeIds, fixedIssueCount } = await cloneAndFixNodes(results);
      
      if (clonedNodeIds.length > 0) {
        // 복제된 노드 중 첫 번째 노드 선택
        const nodes = clonedNodeIds.map(id => figma.getNodeById(id) as SceneNode).filter(Boolean);
        if (nodes.length > 0) {
          figma.currentPage.selection = nodes;
          figma.viewport.scrollAndZoomIntoView(nodes);
        }
        
        // 복제된 노드 검사 결과 얻기
        const fixedResults = [];
        for (const nodeId of clonedNodeIds) {
          const node = figma.getNodeById(nodeId) as SceneNode;
          if (node) {
            const nodeResults = traverseNodes(node, [], excludeHidden);
            fixedResults.push(...nodeResults);
          }
        }
        
        // 완료 메시지 전송
        figma.ui.postMessage({
          type: 'fix-completed',
          message: `${clonedNodeIds.length}개 노드를 복제하여 ${fixedIssueCount}개 이슈를 자동 수정했습니다.`,
          fixedResults: fixedResults,
          originalResults: results
        });
      } else {
        figma.ui.postMessage({
          type: 'fix-failed',
          message: '노드 복제 및 수정에 실패했습니다.'
        });
      }
    } catch (error) {
      console.error('자동 수정 중 오류:', error);
      figma.ui.postMessage({
        type: 'fix-failed',
        message: '오류가 발생했습니다: ' + (error as Error).message
      });
    }
  }
  
  else if (msg.type === 'focus-node') {
    // 특정 노드에 포커스
    const nodeId = msg.nodeId;
    const node = figma.getNodeById(nodeId);
    
    if (node) {
      // 노드가 존재하면 선택하고 뷰포트 조정
      figma.currentPage.selection = [node as SceneNode];
      figma.viewport.scrollAndZoomIntoView([node as SceneNode]);
      
      // UI에 선택된 노드 정보 전송
      figma.ui.postMessage({
        type: 'node-focused',
        nodeId
      });
    }
  }
  
  else if (msg.type === 'close-plugin') {
    figma.closePlugin();
  }
}; 