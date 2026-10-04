Warning: no stdin data received in 3s, proceeding without it. If piping from a slow command, redirect stdin explicitly: < /dev/null to skip, or wait longer.
# Example
m = 4

```
a 2 3 4
```

(Grid shown with annotations)

# Known
Row & Column start @ Value=1

# Ans/Solution
```
pint main() {
  pint m= 4;
  for(int i=1; i<=m; i++)
    for(int j=1; j<=m; j++)
```

[obscured by blue rectangle]

# Observation
1. Right angle triangle
2. Print & only if column Value is less than or equal to Row Value

# TRACE TABLE

| Row (i) | Column (j) | Condition (i<=j) | Output |
|---------|-----------|------------------|--------|
| 1 | 1 | 1<=1 | + |
| 1 | 2 | 2<=1 | = |
| 1 | 3 | 3<=1 | = |
| 1 | 4 | 4<=1 | = |
| 2 | 1 | 1<=2 | + |
| 2 | 2 | 2<=2 | + |
| 2 | 3 | 3<=2 | = |
| 2 | 4 | 4<=2 | = |
| 3 | 1 | 1<=3 | + |
| 3 | 2 | 2<=3 | + |
| 3 | 3 | 3<=3 | + |
| 3 | 4 | 4<=3 | = |
| [obscured] | [obscured] | [obscured] | [obscured] |

# Assumption
D OuterLoop = Row
D InnerLoop = Column

# Example
m=4
```
1
1 2
1 2 3
1 2 3 4
```

(Ramp)
m=4
```
1
2 2
3 2 3
4 4 4 4
```
