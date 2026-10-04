Warning: no stdin data received in 3s, proceeding without it. If piping from a slow command, redirect stdin explicitly: < /dev/null to skip, or wait longer.
```markdown
# Example
m = 4

# Known
Row & column start @ Value=1

# Ans/Solution
```c
pint main() {
  pint m= 4;
  for(int i=J; i<=m; i++)
    for(int j=1; j<=m; j++)
      if(j<=i)
        printf("*d");
      else
        break;
      printf("\n");
  }
  return 0;
```

# Observation
1. Right angle triangle
2. Print * only if column value is less to Row Value

# Assumption
1. OuterLoop = Row
2. InnerLoop = Column

# TRACE_TABLE

| Row (i) | Column (j) | Condition (j<=i) | Output |
|---------|-----------|-----------------|--------|
| 1 | 1 | 1<=1 | ✓ |
| 1 | 2 | 2<=1 | ✓ |
| 2 | 1 | 1<=2 | ✓ |
| 2 | 2 | 2<=2 | ✓ |
| 2 | 3 | 3<=2 | ✓ |
| 3 | 1 | 1<=3 | ✓ |
| 3 | 2 | 2<=3 | ✓ |
| 3 | 3 | 3<=3 | ✓ |
| 3 | 4 | 4<=3 | [obscured] |

**Example: m=4**
```
1
2 2
2 3 3
2 3 3 4
```
```
